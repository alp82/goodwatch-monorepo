# Backlinks and referral traffic: social platforms

Research date: 2026-10-18. Scope: X, Bluesky, Mastodon, Threads, TikTok, Instagram Reels, YouTube Shorts, Pinterest, Facebook groups.

How to read this: a claim with a source URL was checked against that source on 2026-10-18. "(secondary)" means the source is press or a vendor, not the platform. "(not verified)" means I could not confirm it against a primary source. Effort and traffic figures are my estimates unless a source is given.

## Key findings first

1. Every social platform here marks outbound links nofollow, wraps them in a redirect, or renders them only with JavaScript. Social links are not ranking links. They can still help Google discover URLs, because nofollow has been a crawl hint since 2020 (see the Google section). The real value is referral visits, and people who then link from their own blogs, Letterboxd lists, or forums.
2. The shared list preview image is portrait or square (4:5, 9:16 or 1:1, 900 px wide, from `goodwatch-webapp/app/ui/share-card/links.ts` on origin/main). X, Bluesky and Mastodon all draw link cards as landscape. Bluesky crops the card image to 1200:630. Mastodon shows any image that is not wider than it is tall as a small square thumbnail. X's large card expects 2:1. So the designed card shows up cropped or tiny in link previews on the three text networks where links matter most. Title, person and genre OG images are 1200x630 and fit everywhere.
3. Shared list pages and profile pages are `noindex, nofollow`. A share that lands on a list page gives Google a page it will not index and links it is told not to follow. So list shares pass nothing to the title pages they list. See section 3.
4. X now says links are not penalized (Musk, July 2026: "We haven't for over a year"), but posting a link through the X API costs $0.20 per post. Bluesky says it does not de-promote links and has the best-fit film audience feeds for a small account.
5. TikTok, Instagram and YouTube Shorts give no clickable link in the post itself for a normal account. They are reach channels, not link channels. They fit only if the owner wants to make short faceless slideshow videos every week.

## 1. Per-platform findings

### X (Twitter)

**Rules that matter.** X's authenticity policy (April 2025 version, which help.x.com/en/rules-and-policies/platform-manipulation now serves) lists as "content spam":
- "Sending bulk, aggressive, high-volume unsolicited replies, mentions, or direct messages"
- "using trending or popular hashtags with an intent to subvert or manipulate a conversation or to drive traffic or attention to accounts, websites, products"
- "posting with excessive, unrelated hashtags"
- "repeatedly posting or sending direct messages consisting of links shared without commentary, so that this comprises the bulk of your post/direct message activity"
- "promoting content by replying with content that is irrelevant to the topic of the original post"
- "repeatedly posting identical or nearly identical posts"
- "editing links (URLs) so that the final destination page has significantly changed"

Under engagement spam it also bans "engaging with posts aggressively or through the use of automation to drive traffic or attention to accounts, websites, products". Enforcement starts with "Restricting Reach", which means removal from search, trends and For You and "restricting a post's discoverability to the author's profile". Suspension comes after that. One person may run up to 10 accounts "for different, non-duplicative purposes", and a personal account plus a project account is listed as allowed. Cross-posting the same content across your own accounts is not allowed.

What this means for a solo maker: a GoodWatch account that mostly posts bare links, or replies to big film accounts with GoodWatch links, matches the policy text. Posts with commentary, data, or an image, plus a link some of the time, do not.

**Automation.** X automation rules say automated replies are allowed only when the user opted in, for example by mentioning the bot (help.x.com/en/rules-and-policies/x-automation; the page blocks automated fetchers, so I read it only through search snippets; not verified in full). The X API is now pay per use: $0.015 to create a post and $0.200 to create a post with a URL. There is no general free tier, and pay-per-use plans are capped at 3 million post reads per month (docs.x.com pricing page, read 2026-10-18, no date on the page). A daily auto-post with a link would cost about $6 a month. That breaks the no-paid-services budget, and it is the kind of link posting X treats as a spam vector.

**Link reach, dated statements.**
- 2023: X removed headlines from link cards, leaving image plus domain (Social Media Today, Oct 2023, secondary). Headlines came back in a small overlay on the image around January 2024 (NewscastStudio, 2024-01-04, secondary).
- November 2024: Musk told Paul Graham to put a description in the main post and the link in the reply. Media read this as confirming link posts were downranked (Mediaite, Business Insider, secondary).
- October 2025: X tested and rolled out an iOS in-app browser that keeps the post visible while the link is open. Nikita Bier (head of product) said link posts are not deboosted (Gigazine 2025-11-05, roboin.io 2025-10-20, secondary).
- 2026-04-13: Bier replied "Fake news" to a claim that links are penalized: "Just post the link in the body of the post and provide sufficient context about what the user will see before they click it" (roboin.io 2026-04-13, secondary).
- 2026-07-28/29: Bier told Zuckerberg "you do not need to put the links in replies anymore". Musk replied to Graham: "We haven't for over a year" (PPC Land, secondary; only one outlet found).

Takeaway: X's current public line is that links in the post body are fine if the text explains what the click shows. Third-party claims of a "30 to 50 percent" link penalty come from vendor blogs (not verified).

**Link handling.** X wraps links in t.co. Links on X are widely reported to be nofollow (not verified; X post pages block fetchers).

**Preview card.** `summary_large_image`: "aspect ratio of 2:1 with minimum dimensions of 300x157 or maximum of 4096x4096 pixels. Images must be less than 5MB in size. JPG, PNG, WEBP and GIF formats are supported" (developer.x.com cards docs, archived 2025 copy, since the live page is blocked). X reads og: tags when twitter: tags are missing. GoodWatch's 1200x630 title images fit, with a small crop. Portrait list cards get a center crop of about a third of their height.

**What works (not verified unless cited).** Image posts (a chart, a critics vs audience gap, a top 5 card) with the link in the body. Replies that add facts to film conversations. Quote posts of film news with "where it streams" data. Reply boosts from X Premium cost money, so they fall outside budget.

**Do.** Post the card image natively, with one sentence of context and the link. Vary the text. Reply only where the GoodWatch fact answers the thread.
**Don't.** Post bare links. Paste the same reply under many accounts. Ride trending tags unrelated to the film. Automate replies. Run a second account to boost the first.

Sources: help.x.com/en/rules-and-policies/platform-manipulation (Authenticity, April 2025, read via archive 2026); docs.x.com/x-api/getting-started/pricing (read 2026-10-18); developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image (archived 2025); https://ppc.land/x-drops-year-old-link-penalty-musk-tells-zuckerberg-on-platform/ (2026-07); https://roboin.io/article/en/2026/04/13/x-denies-link-deboost-recommends-in-post-links/ (2026-04-13); https://gigazine.net/gsc_news/en/20251105-x-post-url-link (2025-11-05); https://www.mediaite.com/media/news/elon-musk-admits-x-is-throttling-links-effectively-limiting-people-from-reading-news/ (2024-11); https://www.newscaststudio.com/2024/01/04/x-headlines-restored/ (2024-01-04).

### Bluesky

**Rules that matter.** Community Guidelines, "Last Updated: September 19, 2025":
- 3.1.1: "Do not send spam or repeatedly post content in ways that disrupt normal conversations or service use."
- 3.1.3: "Do not artificially manipulate features or social signals to gain unearned reach or mislead users."
- 3.1.4: commercial content must be disclosed. A maker posting about their own free site should say it is theirs.

There is no separate self-promotion rule. Rate limit docs say "bulk or spammy interactions are against the Community Guidelines".

**Bots.** Bluesky's bot docs: "Automated bots that post to an account on an regular interval are welcome." "If your bot interacts with other users, please only interact (like, repost, reply, etc.) if the user has tagged the bot account. It must be an opt-in interaction, or else your bot may be taken for spam." Bots "should identify themselves by adding a self-label to their profile" (`bot` self-label). Write limits are 5,000 points per hour and 35,000 per day, where a create costs 3 points. That is far above anything GoodWatch would need. The API is free.

**Link reach.** COO Rose Wang: "unlike other platforms, we don't de-promote your links" (TechCrunch, 2025-03-20). Since app version 1.99 (March 2025), outbound clicks carry the referrer `go.bsky.app`, so they show in analytics. Publisher data from late 2024: the Boston Globe reported 3x more traffic from Bluesky than Threads, and Guardian Australia at least 2x (Press Gazette 2024-11-29, secondary). Chartbeat data put Bluesky at about 0.8 percent of X's referral traffic to publishers (Digiday, secondary, date not shown). So Bluesky clicks well per post, but its total audience is much smaller than X's.

**Link handling (checked in source 2026-10-18).** The web app sets external links to `rel="noopener noreferrer"`, without nofollow (`src/components/Link.tsx` in bluesky-social/social-app). The embed widget adds nofollow. The server HTML that crawlers fetch first holds the post text only in meta tags, with no anchor to the outbound link. The link appears only after JavaScript renders. bsky.app robots.txt allows crawling and lists a user sitemap. Whether Google follows Bluesky post links is not verified.

**Preview card.** Link cards (`app.bsky.embed.external`) come from Open Graph. The posting client fetches the image once and stores it as a blob of at most 1,000,000 bytes (lexicon `maxSize: 1000000`). So the card is a snapshot from posting time and later page changes do not update it. The app draws the card image at `CARD_ASPECT_RATIO = 1200 / 630`, so a portrait list card is cropped to a landscape band. A post holds one embed: either attached images or a link card. A post with the card attached as an image shows no link card, but the URL in the text stays clickable.

**Film audience (live data, 2026-10-18, Bluesky public API).** The "Film Sky" the brief asked about exists as feeds and a tag:
- "📽️ Film", 9,794 likes, "Filmsky posts, movie news & reviews, trailers, Letterboxd chatter"
- "Filmsky", 528 likes, picks up any post with the word "filmsky"
- "📺 TV", 378 likes, "TVSky posts, TV news, episode reviews, Serializd chatter"
- "Horror", 711 likes, picks up "HorrorSky", "#Horror" and horror terms
- "MovieSky", 224 likes, "#moviesky"
- "Oscars", 151 likes, made with a film news account
- "Movies 🎬", 328 likes, requires the 🎬 emoji

These keyword feeds are the main way a small account reaches film fans, so a #FilmSky or #TVSky tag on a relevant post is the norm, not spam. One tag that fits is enough.

**What works (anecdotal, not verified).** Conversational posts with an image. Threads of "leaving Netflix this month" or "new on streaming this week" with posters. Replying to film critics and writers who are active there. Starter packs for discovery.

**Do.** Add the `bot` self-label if anything is automated. Say "I built this" in the bio and in early posts. Post the 1200x630 title OG pages as link cards.
**Don't.** Auto-reply, auto-like or follow in bulk. Post into every film feed tag at once.

Sources: https://bsky.social/about/support/community-guidelines (updated 2025-09-19); bsky-docs `docs/starter-templates/bots.mdx` and `docs/advanced-guides/rate-limits.md` (GitHub, read 2026-10-18); atproto `lexicons/app/bsky/embed/external.json`; social-app `src/lib/constants.ts`, `src/components/Link.tsx`; https://techcrunch.com/2025/03/20/bluesky-makes-it-easier-for-publishers-to-track-referrals (2025-03-20); https://pressgazette.co.uk/?p=234447 (2024-11-29); https://digiday.com/media/media-briefing-publishers-strategy-on-bluesky-is-tbd/; public.api.bsky.app getPopularFeedGenerators (queried 2026-10-18).

### Mastodon and film-focused servers

**Rules that matter.** Each server sets its own rules. mastodon.social and mastodon.online (rules API, 2026-10-18) include: "Content created by others must be attributed, and use of generative AI must be disclosed." That matters if a post quotes the LLM-made title analysis: say it is AI-written. zirk.us (an arts and humanities server that lists film) says "No spam." I found no large, active, film-only Mastodon server. socel.net is for animation, and zirk.us is arts in general (fedi.garden, secondary). Community norms on Mastodon go against brand accounts that post only their own links (not verified, widely reported).

**Bot flag.** "Enabling the bot flag will add a bot icon to your profile"; "Mastodon currently treats the bot flag as a visual indication only" (docs.joinmastodon.org/user/profile). Use it for any automated feed account.

**Link handling (checked in source).** Mastodon adds `rel="nofollow noopener"` to links in posts (`DEFAULT_REL = %w(nofollow noopener)` in app/lib/text_formatter.rb) and "nofollow noopener noreferrer me" to profile field links. Profile links can get a verified checkmark if the linked page links back with `rel="me"` in its server-rendered HTML.

**Preview card (checked in source).** Each server fetches the URL's OpenGraph itself, so one popular post sends a burst of fetches from many servers (issue #4486, "Mastodon can be used as a DDOS tool", 2017; still the design). The card image may be up to 8 MB in JPEG, PNG, GIF or WebP, and is stored resized to about 230,400 pixels (640x360). The web UI shows the large 1.91:1 card only when `card.width > card.height`. A square or portrait image gets a small square thumbnail. Mastodon 4.3 added author attribution through a `fediverse:creator` meta tag. A malformed one can stop the whole card from rendering (issue #40102, 2026-08-09).

**Hashtags (mastodon.social tag API, last 7 days as that server sees them, 2026-10-18).** #film 1,895 uses by 766 accounts, #movies 1,279 by 641, #horror 872 by 653, #cinema 602 by 373, #streaming 1,004 by 539, #netflix 616 by 348, #FilmMastodon 122 by 29, #letterboxd 83 by 61, #TVMastodon 19 by 10, #TCMParty 65 by 9. #FilmTodon and #TVTodon showed 0 uses, so those are not live tags. Mastodon search and discovery work mostly through hashtags, so one or two accurate tags per post is normal practice.

**Do.** Run a personal maker account on a general server and post with camel-case tags (#FilmMastodon, #Horror) and alt text. Disclose AI-written text.
**Don't.** Run a link-only brand account or post the same link to many tags.

Sources: docs.joinmastodon.org/user/profile/; docs.joinmastodon.org/entities/PreviewCard/; github.com/mastodon/mastodon (app/models/preview_card.rb, app/lib/text_formatter.rb, app/javascript/mastodon/features/status/components/card.tsx; read 2026-10-18); https://github.com/mastodon/mastodon/issues/4486; https://github.com/mastodon/mastodon/issues/40102; mastodon.social /api/v1/tags and /api/v1/instance/rules (2026-10-18).

### Threads

**Rules.** Threads follows Meta's Community Standards, which include a Spam policy. Meta's transparency pages would not load for me. An Oversight Board summary quotes the spam policy as banning a link "that promises one type of content but delivers something substantially different" (secondary). High-frequency posting and engagement bait are reported as spam signals (secondary).

**Link reach, dated statements.** Adam Mosseri in November 2024: "we don't place much value on [link clicks] and people don't like and comment on links much". In mid-2025: "We've been working on making sure links are ranked properly. Links have been working much better for more than a month now" (Social Media Today, 2025-06-08, secondary). In May 2025 Threads added up to 5 profile links and click tracking for links in bios and posts (TechCrunch, 2025-05-15, secondary). Since 2025-12-22 the Threads API rejects posts with more than 5 links (Meta developer docs, text attachments page). Communities and topic tags launched as a worldwide beta in October 2025, including "TV Threads", with one tag per post (9to5Mac, 2025-10-02, secondary).

**Link handling.** Not verified (nofollow and redirect wrapping unconfirmed).
**Preview card.** Built from OpenGraph (not verified against Meta docs).
**What works.** Text-first posts and replies inside the TV and film communities. One topic tag. Not verified beyond that.

Sources: https://www.socialmediatoday.com/news/meta-says-link-posts-ranked-properly-threads-reach/750126/ (2025-06-08); https://techcrunch.com/2025/05/15/threads-now-lets-creators-add-up-to-5-links-to-profiles-track-clicks; https://developers.facebook.com/documentation/threads/create-posts/text-attachments; https://9to5mac.com/2025/10/02/threads-announces-topic-based-communities/.

### TikTok

**Rules that matter.** From the Community Guidelines effective 2025-09-13 (official text mirrored by Open Terms Archive):
- Spam includes "Using automation to run many accounts or send repetitive content" and "Posting a large amount of irrelevant material".
- External links: "If a link breaks our rules, we'll remove it. We may also temporarily stop you from posting links."
- Comments that are "Random text, irrelevant promotions, or links" are sorted lower.
- Not eligible for the For You feed: "Reused or unoriginal content posted without creative edits, such as clips that show someone else's watermark or logo" and "Low-quality or minimally edited content, such as short clips made from GIFs only".
- Copyright: "You should only post content you created or have the right to share." Movie clips and trailers are a takedown risk.
- Repeated FYF-ineligible posts can make the whole account ineligible for For You for a while.

**Links.** Posts have no clickable links. A website link in the bio reportedly needs 1,000+ followers or a registered business account (Shopify, Rocketlink, secondary; TikTok's own page did not say).
**Formats without showing a face.** Photo mode carousels (still images with music, since October 2022, secondary) suit list cards and "critics vs audience" slides. The 9:16 list designs (Podium, Receipt, Ticket, and others) are already native story size.
**Expected traffic.** Bio-link traffic only. Not verified. Viral reach is possible but unpredictable.

Sources: https://github.com/OpenTermsArchive/contrib-versions/blob/main/TikTok/Community%20Guidelines.md (mirror of the 2025H2 guidelines, effective 2025-09-13); https://www.shopify.com/blog/how-to-add-link-to-tiktok-bio (secondary); https://www.socialmediatoday.com/news/TikTok-Adds-Photo-Mode-for-Still-Images-Longer-Video-Captions/633663/ (2022, secondary).

### Instagram (Reels)

**Links.** Up to 5 bio links for all accounts since April 2023 (Search Engine Land, secondary). Caption links are plain text. Clickable Reel or caption links are reported only for Meta Verified subscribers (March 2026 test, secondary), and Meta Verified is paid, so outside budget. Story link stickers are open to all accounts (not verified against primary).
**Rules.** Meta Community Standards on spam, plus Meta's July 2025 crackdown on unoriginal content: accounts that repeatedly reuse others' videos, photos or text get "reduced distribution on everything they share" (Meta post 2025-07-14, quoted by TechCrunch and Bitdefender, secondary). That announcement was about Facebook. Applying it to Instagram is my inference.
**Fit.** The 4:5 list designs (Manifesto, Cover, VHS, Front page, Rental, Teletext) are native feed size. They work as reach content with "link in bio". Low link value.

Sources: https://searchengineland.com/instagram-now-allows-up-to-5-links-in-bio-395742 (2023); https://www.inro.social/blog/meta-verified-clickable-links-instagram-reels-pricing (2026, secondary); https://techcrunch.com/?p=3027715 (2025-07).

### YouTube Shorts

**Rules that matter.** The spam, deceptive practices and scams policy bans content made "solely to drive users off of YouTube to external sites". It also bans "high-volume, repetitive, or deceptive comments", "maliciously misleading titles, thumbnails", and using tools to "flood our platform with repetitive content". On 2025-07-15 YouTube renamed its "repetitious content" monetization policy to "inauthentic content", targeting mass-produced and repetitive videos (secondary; YouTube called it "a minor update"). Templated auto-generated Shorts from GoodWatch data would carry that risk.
**Links.** Since 2023-08-31, links in Shorts descriptions and comments are not clickable (secondary, many outlets). A Short can link only to another video on the same channel through "related video" (support.google.com/youtube/answer/14075157). YouTube also lists a separate "link to a brand's site" option for Shorts (support.google.com/youtube/answer/16722303, not read, likely for brand deals). Channel profile links are clickable. Description links on long videos are clickable. Whether those are nofollow is not verified.
**Fit.** Low link value. Possible reach. Film clips carry Content ID risk.

Sources: https://support.google.com/youtube/answer/2801973 (read 2026-10-18); https://support.google.com/youtube/answer/14075157; https://www.malwarebytes.com/blog/news/2023/08/youtube-makes-sweeping-changes-to-tackle-spam-on-shorts-videos (2023-08); https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/ (2025-07).

### Pinterest

**Rules that matter.** Community Guidelines, last updated May 2026, with updated guidelines taking effect 2026-11-12:
- "Don't use automation that hasn't been explicitly approved by Pinterest."
- No "repetitive, deceptive, or irrelevant content" made to earn money.
- No links to sites that are "unsafe, deceptive, untrustworthy, copied, or that promote spam".
- No "redirecting existing Pins to new destinations".
- No keyword stuffing.
- Links with "excessive or deceptive redirects may be blocked".
- Pinners "should be able to predict where a link leads".

Vendor guidance warns that pinning the same image or URL many times in a short window triggers spam flags (Tailwind, secondary).

**Links.** Every pin has a clickable destination link, the only platform here where that is true for every post. Pin links are reported to be nofollow (2012 to 2014 SEO forum posts, not verified now). Claiming the website (HTML tag, file, or DNS TXT) attributes pins saved from goodwatch.app to the GoodWatch profile and adds analytics (help.pinterest.com, read 2026-10-18).
**Format.** 2:3 at 1000x1500 is the recommended pin size (Tailwind citing Pinterest, secondary). The 4:5 list cards are close. A 2:3 variant would fit better.
**Movie referral value.** Whether movie and TV pins send real traffic is not verified. Pinterest is search-driven and pins stay findable for months, which suits evergreen "best X on Netflix" or mood boards (anecdotal). Posters and stills are copyrighted. Original GoodWatch cards with small poster thumbnails are less risky than reposting posters (not verified).

Sources: https://policy.pinterest.com/en/community-guidelines (May 2026); https://help.pinterest.com/en/business/article/claim-your-website; https://www.tailwindapp.com/blog/pinterest-image-size (secondary).

### Facebook groups (brief)

Group admins set their own rules, and most film groups ban self-promotion or allow it only on set days (not verified, varies by group). In December 2025 Meta tested limiting some Professional Mode profiles and Pages without Meta Verified to about two organic link posts per month. Links in comments were not limited. Meta called it "a limited test" (TechCrunch, 2025-12-17). Current status is not verified. Low fit: high effort to find good groups, removal risk, almost no SEO value.

Source: https://techcrunch.com/2025/12/17/facebook-is-testing-a-link-posting-limit-for-professional-accounts-and-pages (2025-12-17).

### Messaging apps (where shared lists actually travel)

- **WhatsApp:** the og:image "should be under 600KB in size", "300px or more in width with 4:1 width/height or less aspect ratio", and the `<head>` must be in the first 300 KB of the HTML (Meta developer docs, link previews). Some report a stricter 300 KB image limit (Wix, secondary). The list preview at no more than 145 KB passes both.
- **iMessage:** Apple's TN3156 covers rich previews. The origin/main code comment says Apple asks for at least 900 px, which is why previews are 900 px wide. I could not read TN3156's body (not verified).
- **Discord:** embeds come from og: tags (not verified).

### Google and nofollow (applies to every platform)

Google, 2019-09-10: "All the link attributes, sponsored, ugc, and nofollow, are treated as hints about which links to consider or exclude within Search." "For crawling and indexing purposes, nofollow will become a hint as of March 1, 2020." Google's current outbound links doc (updated 2025-12-10) says such links "will generally not be followed". Linked pages "may still be crawled" if found through sitemaps or other sites. Social links are a weak discovery signal at best, not ranking links.

Sources: https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify (2019-09-10); https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (2025-12-10).

## 2. Summary table

Effort is hours per week for the owner. Ban risk assumes the owner follows the do/don't lists. Expected referral traffic is my estimate for the first three months and is not verified anywhere.

| Platform | Effort/week | Ban risk | Link value | Expected referral traffic | Prerequisites | Fit |
|---|---|---|---|---|---|---|
| Bluesky | 1.5 to 2 h | Low | Discovery only (web app links lack nofollow, but render only with JS; not verified) | Low but steady, tens of visits/week if posts land in Film or TV feeds (not verified) | Personal or project account, bot label if automated, landscape list preview | High |
| X | 1.5 to 2 h | Low to medium (reply spam and bare links get reach limits) | Nofollow via t.co (not verified), discovery only | Low, uneven; a hit can spike (not verified) | Account, no API posting (costs $0.20 per link post) | Medium |
| Mastodon | 1 h | Low on general servers; brand-only accounts get muted (not verified) | Nofollow (confirmed in source) | Very low (not verified) | Account on a general server, hashtags, AI disclosure | Medium (dev and open-source crowd also fits the public repo and MCP angle) |
| Threads | 1 h | Low | Not verified | Low (not verified) | Instagram-linked account | Low to medium |
| Pinterest | 1 to 2 h (batch weekly) | Low if not repetitive | Nofollow reported (old sources), but every pin links out | Unknown; slow build over months (not verified) | Business account, claimed site, 2:3 images | Medium, experimental |
| TikTok | 3 to 5 h (2 to 3 carousels) | Low to medium (copyright on clips, FYF ineligibility for reused content) | None in posts; bio link after 1,000 followers | Unknown; mostly brand reach (not verified) | 9:16 cards, original edits, no film clips | Low unless owner wants video |
| Instagram Reels | 2 to 4 h (reuse TikTok edits) | Low to medium (unoriginal content rules) | None in posts; 5 bio links | Very low (not verified) | 4:5 or 9:16 cards | Low |
| YouTube Shorts | 2 to 4 h (reuse edits) | Medium for templated mass output ("inauthentic content") | None in Shorts; channel links only | Very low (not verified) | Channel, original voice or text | Low |
| Facebook groups | 1 to 2 h | Medium (admin removals) | None | Very low (not verified) | Joined groups with promo days | Low |

## 3. Shareable lists, OG cards, and the noindex,nofollow question

**How lists and cards help today.**
- Every share puts a GoodWatch-designed image and goodwatch.app in front of the sharer's friends. That is the one social action that comes from members, not from the owner's time.
- Title, person and genre OG images (1200x630) suit X, Bluesky, Mastodon, Threads, WhatsApp and iMessage. Posting a title page as a link card is the safest owner post.
- Members who share a list on a blog or forum create real, crawlable links. Those are the backlinks this research is after.

**Problem 1: the list preview shape.** List previews keep the design's shape (4:5, 9:16 or 1:1). Bluesky crops the card to 1200:630. Mastodon shows non-landscape images as small square thumbnails. X expects 2:1. The designed card looks best when posted as a native image, which only works if the poster attaches it (the in-app share flow likely handles this; not checked).

**Problem 2: noindex, nofollow on list pages.** Reasoning from Google's docs:
- `noindex` means "Do not show this page ... in search results." A list page with external links pointing to it still cannot rank or appear in search.
- `nofollow` as a robots meta value means "Do not follow the links on this page." Without it, "Google may use the page's links to discover other pages." With it, the list page's links to /movie/... and /tv/... title pages are not used for discovery. Whatever a list page receives from outside links therefore stops at the list page, which itself is not indexed.
- Even `noindex, follow` is not a full fix. Google's John Mueller said in a December 2017 video that a long-term noindex, follow page is eventually treated like noindex, nofollow (Search Engine Roundtable, secondary).
- Google must crawl a page to see these rules (robots meta doc, updated 2026-03-24). Crawling still happens; only indexing and following are refused.

Net effect: list shares now bring human visits but no SEO benefit to title pages. That is a real loss, because lists are the content most likely to get linked from blogs and forums. The codebase already uses `noindex, follow` on discover (`routes/discover.($type).tsx`), so a softer setting has a precedent.

**Questions for the owner (no code change proposed):**
1. Should shared list pages switch from `noindex, nofollow` to `noindex, follow`? Inbound links from blogs and forums would then help Google reach the listed title pages, while list pages stay out of search. This is low risk for privacy, since the page is already public by URL.
2. Should lists that pass a bar become indexable, with a self canonical? A possible bar: the member opted in, a custom title, 5 or more titles, and a short note. That would let a good list rank for "best X" searches and pass full value to titles. The trade-offs are thin or near-duplicate top-5 pages (a site-quality risk) and member handles appearing in Google.
3. Should profile pages stay `noindex, nofollow`? I would suggest keeping profiles noindex for privacy and asking only about `follow`.
4. Should each list get a 1200x630 link-preview image (the card centered on a branded landscape background) for og:image and twitter:image, while the portrait or square card stays the downloadable image for native posts? Also, should there be a 2:3 variant for Pinterest?

## 4. Recommended top 4 moves from this family

1. **Bluesky first, as a maker account.** Post 3 to 5 times a week into the live film and TV feeds (#FilmSky, #TVSky, #HorrorSky, using one tag per post), with GoodWatch data as the hook. Hooks: critics vs audience gaps, "leaving Netflix this month" per country, "where to stream" for films in the news. Put the link in the post body, 1200x630 title cards as link previews, and the list card as an image. Reply to film writers only when the reply adds a fact. No automation beyond a clearly labeled, opt-in bot, if any. Budget: about 2 h a week.
2. **Fix the share surfaces before pushing lists.** Ask the owner the section 3 questions: `follow` on list pages, possible indexing of good lists, and a landscape preview image. Each member share then shows a clean card on X, Bluesky and Mastodon, and passes discovery to title pages. This is the one move that scales without the owner's time.
3. **X with the same posts, adapted by hand.** Same data posts with the link in the body and a sentence of context, which matches X's 2026 guidance. Manual posting only: the API charges $0.20 per link post, and automated engagement is named in the spam policy. Budget: about 1 h a week, reusing Bluesky drafts with varied wording so they are not copypasta.
4. **A Mastodon maker account on a general server, plus a Pinterest test.** On Mastodon, post the open-source, MCP and "built solo" side, and film posts with #FilmMastodon, #Horror and #Movies. Disclose AI-written analysis. Note that every server fetches the page, so the OG route must handle bursts. For Pinterest, claim goodwatch.app and run a 6-week test of 5 to 10 original 2:3 pins a week (mood and "best on Netflix" boards). Keep it only if analytics show clicks. TikTok, Reels and Shorts wait until there is a repeatable faceless carousel format and the owner wants weekly video work.

# Backlinks round 2: micro creators

Researched 2026-10-21. Scope: how you can find movie and TV creators with roughly 1,000 to 50,000 followers or subscribers on YouTube, Bluesky, Letterboxd, X, TikTok, Instagram, Reddit, podcasts, and newsletters (Substack, Ghost, Beehiiv), using free tools only. It also covers which creator types fit GoodWatch, what you can offer them for free, the disclosure and link rules that apply when you give them anything, how to contact them without being blocked or breaking German, EU, UK, or US email law, and a short outreach template. Research only: nothing was posted, followed, subscribed to, or sent. Round 1 covered posting from your own accounts ([03-social.md](../backlinks/03-social.md)) and data studies, widgets, and journalist platforms ([05-linkable-assets-pr.md](../backlinks/05-linkable-assets-pr.md)). This report doesn't repeat them. It names no individual creators: the private candidate list (outside the repo) has 50 candidates.

Labels: "(not verified)" means no primary source confirmed the claim. "Estimate" means a number I derived, not one a platform published. Every source was read on 2026-10-21 unless a date says otherwise. This is not legal advice.

## Summary

- **Creators matter for visitors and for the few followed links they control.** YouTube channel and description links go through a `youtube.com/redirect` wrapper, and social posts are nofollow or JavaScript-only ([03-social.md](../backlinks/03-social.md)). The followed links come from creators' own sites and newsletter archives. A link in a Substack post body had no `rel` value at all in the post HTML checked (one post, 2026-10-21), so a newsletter that cites GoodWatch gives a followed link on its public archive page.
- **Five creator types fit best:** episode-ranking and recap creators (the season and episode grid is their format), data and map creators (the 139-country study), streaming-guide newsletters and channels ("what's worth watching this week"), international-catalogue and Anglophile-TV creators ("where can I watch it outside the US"), and AI-tool creators who demo Claude or ChatGPT apps (the MCP server). German film and TV creators are mostly podcasters, so the German list leans on Apple Podcasts charts.
- **Free tools are enough to build and size a list.** YouTube search sorted by upload date, Social Blade's free pages, the Bluesky public API (follower counts, starter packs), Substack's Film & TV leaderboard JSON (with subscriber counts), Ghost Explore, the iTunes Search API and genre chart feeds, and podcast RSS feeds all worked from a plain script, as did TikTok and Instagram follower counts and a free third-party API for X counts. TikTok and Instagram discovery, Reddit, and Letterboxd bios need a logged-in browser.
- **Offer data, not gifts.** The useful offers are custom numbers from the streaming study for the creator's country, a season grid image for a show they cover, early access, and a quote. Anything of value creates a "material connection" under the FTC's rules and an "ähnliche Gegenleistung" under German law (§ 5a (4) UWG), so the creator should say where the data came from. A plain "Data: GoodWatch" credit does that.
- **Never ask for a link.** Google lists "Exchanging goods or services for links" and "Sending someone a product in exchange for them writing about it and including a link" as link spam. Ask for nothing about links. If a creator links, that is their editorial choice. If anyone ever offers a link as part of a deal, it must carry `rel="sponsored"` or `rel="nofollow"`.
- **Don't cold email German creators.** § 7 (2) Nr. 2 UWG treats advertising by email without "vorherige ausdrückliche Einwilligung" as an unreasonable nuisance, for businesses as well as consumers. The BGH held that a published email address is not consent to unrelated commercial requests. For German recipients, use only channels the creator explicitly invites for suggestions, such as a podcast's listener mail address offered for topic tips, or a public reply. US law (CAN-SPAM) allows cold B2B email with opt-out rules. UK law (PECR) allows it to companies, but treats sole traders, which most creators are, like individuals who must opt in.
- **One personal message per creator.** Reference one specific video, episode, or post of theirs, use the contact channel they publish, and send nothing else unless they reply. Mass DMs and follow-unfollow are named spam on X, Bluesky, and Letterboxd.

## 1. Creator types that fit, and the hook for each

| Creator type | GoodWatch hook | Best platforms | What to offer | Fit |
| --- | --- | --- | --- | --- |
| Episode-ranking and "every season ranked" creators | Season and episode grid per show, with IMDb episode ratings plus Rotten Tomatoes and Metacritic season scores | YouTube, TikTok, Bluesky | A grid image for the show in their next video, with the IMDb credit line in the image | High |
| TV recap, after-show, and rewatch podcasts | The grid shows which episodes viewers rated highest, season by season; episode tracking for their listeners | Apple Podcasts, YouTube video podcasts | The grid for the show they are recapping, sent once before a season finale | High |
| Film data, statistics, and map creators | The 139-country study: the US streams 3,478 of 4,683 tracked movies, Netflix US has 548 (50th of 55), Switzerland's Netflix has 799, 17 Ghibli films are on Netflix in 129 countries but not Japan | YouTube, newsletters, Bluesky | A custom cut of the study for a map or chart ("your country's Netflix vs the US"), with the method note | High |
| Streaming-guide creators ("new this week", "leaving Netflix") | One combined score from IMDb, Rotten Tomatoes, and Metacritic for every title in their list; availability by country | YouTube, newsletters, Instagram, TikTok | Combined scores for this month's list, or a "what leaves Netflix US but stays elsewhere" table | Medium to high |
| International-catalogue and Anglophile-TV creators | Where a show streams in 139 countries | Newsletters, YouTube | A table of where a British or Japanese show streams by country | High |
| Streaming-business newsletters (European, MENA) | Per-country catalogue counts and the "Netflix leads for shows in 55 of 56 markets" finding | Substack | The study page plus one finding for their region | High |
| Letterboxd-centric creators and film list makers | Letterboxd import, combined score, shareable top-5 cards | Letterboxd, Bluesky, YouTube | Early access to a feature they would use | Medium |
| "Where to watch" and cord-cutting creators | Availability per title | YouTube | Low: many are affiliate how-to channels with low views per video | Low to medium |
| AI-tool creators who cover Claude or ChatGPT apps | A consumer MCP app with poster cards in chat (https://goodwatch.app/mcp) | YouTube | A short demo script and early access to new tools | Medium to high |

Notes from the search:

- Prestige-TV episode rankers are rare on YouTube. Most "every episode ranked" channels rank cartoons or have stopped posting.
- Film data creators are scarce. The search "imdb ratings analysis" returns mostly Python tutorials.
- Search results for "new on Netflix" and "streaming tips", in English and German, are flooded with faceless trailer and "top 10" compilation channels. Their subscriber counts look right, but recent videos get tens to hundreds of views. Check views on the latest uploads, not only subscriber counts.

## 2. How to find them, per platform

Every method below uses free pages or free APIs. "Script" means it worked with `curl` from this machine on 2026-10-21. "Browser" means it needs a logged-in browser.

| Platform | How to find small, active creators | How to check size | How to check recency | Contact channel to use | Access |
| --- | --- | --- | --- | --- | --- |
| YouTube | Search with upload-date sort (`/results?search_query=...&sp=CAI%3D`). Small channels show up next to big ones, and only active ones. The channel filter (`sp=EgIQAg%3D%3D`) works as a size sieve once you know the niche word. Queries that found keepers: "every season ranked", "season finale recap review", "movie data visualization", "film data", "netflix catalog by country", "leaving netflix", "binge watch guide", "mcp apps", "claude connectors"; German: "neu auf netflix", "streaming tipps", "Claude Connectoren". | About page (`/@HANDLE/about`) shows the subscriber count. Social Blade's free page shows a 14-day daily table of subscribers and views, which separates growing channels from dead ones. | Videos tab ("2 weeks ago"). The watch page has an exact `publishDate`. | The "business email" on the About page (the page JSON field `signInForBusinessEmail` tells you one exists; the address sits behind sign-in and a captcha), or the website or Linktree listed there | Script. From an EU IP, YouTube redirects to a consent page; a `SOCS=CAI` cookie skips it. |
| Bluesky | Starter packs are the fastest route: the public API's `app.bsky.graph.searchStarterPacks` (queries: film, filmsky, tv, tvsky, horror, letterboxd, critics), then `getStarterPack` and `getList` to read the members. `searchActors` with genre words also works, including German words such as "Filmkritik" and "Serien". Paging through starter-pack search found 528 packs for "film", 479 for "tv", 454 for "movies", 22 for "filmsky", 6 for "letterboxd", and 1 for "tvsky"; "streaming" (158) is mostly tech and game streaming. Search results report pack popularity as zero, so judge packs by name. The most useful were film critic packs, "Moviesky" packs, TV journalism and TCA packs, multi-part "filmsky" packs, and Letterboxd starter packs. Pipeline: pack, then its member list, then batch `getProfiles`, then a follower filter (1,000 to 60,000) and a bio keyword filter (stream, netflix, recap, episode, newsletter, data, letterboxd). 57 packs gave 2,894 profiles, 1,626 in range, 355 with a matching bio. Critic packs are mostly staff critics; streaming-guide and data accounts came from `searchActors` ("streaming guide", "streaming catalog", "tv newsletter", "tv ratings", "box office data"). Public web directories of starter packs did not help: one returned 403 to scripts and web fetches, another renders only with JavaScript, and the bsky.app search page is an app shell. | `app.bsky.actor.getProfile` returns `followersCount` | `app.bsky.feed.getAuthorFeed` with `filter=posts_no_replies` | The website or newsletter in the bio. DM only if the bio invites it. | Script |
| Letterboxd | The popular reviewers page (`/reviewers/popular/`) loads without a browser; the weekly popular members and weekly popular lists pages returned 403. Most popular members are far above 50,000 followers, so look for reviewers and list makers who also link a newsletter, YouTube channel, or Bluesky account in the bio. Profile pages hit a Cloudflare challenge, but `/USER/followers/` (follower count in a tooltip), `/USER/rss/` (recency), and `/lists/popular/` load with plain `curl`. None of them show the bio, so the trick is to start from Bluesky bios that link a Letterboxd profile (330 in the starter-pack sample), resolve `boxd.it` short links with `curl -w '%{redirect_url}'`, and then read the follower count. That gives both a verified size and a verified contact platform. | `/USER/followers/` page | `/USER/rss/` feed | The external link in the bio, read on the creator's other platforms. Letterboxd appears to have no private messages, only public comments (not verified against an official page), and its terms forbid following "to generate reciprocal follows". | Script for counts and recency; browser for bios (Cloudflare challenge) |
| X | Lists made by film writers, and searches such as `"every episode ranked" min_faves:20 -filter:replies`. The free third-party FxTwitter API (`api.fxtwitter.com/HANDLE` for followers and bio, `/2/profile/HANDLE/statuses` for recent posts) returned counts when x.com, Social Blade's X pages, and Nitter mirrors did not. It also exposed accounts with large follower counts that stopped posting in 2024 or 2025, which is common among film people who moved to Bluesky. | FxTwitter API `followers` field | FxTwitter statuses `created_at`; filter out reposts | The website in the bio | Browser for discovery. x.com returned 402 to fetches; counts came from the FxTwitter API (unofficial). |
| TikTok | In-app search with the "Users" tab and hashtags (#filmtok, #tvtok, #letterboxd, #whattowatch, #newonnetflix). Web search with `site:tiktok.com` finds individual videos and their creators. | Profile page JSON has `followerCount` (script) | A video ID encodes its upload time: the ID shifted right by 32 bits is a Unix timestamp. That dates any video URL you find. | The link-in-bio page or "business email" in the bio | Profile counts by script; discovery needs the app. Tag and discover pages render only with JavaScript. |
| Instagram | Hashtags and "suggested" accounts, logged in | The profile's meta description ("8,002 Followers, ...") loads with a link-preview user agent | Logged in only (not verified by script) | Link in bio or the business "Email" button | Browser for discovery; counts by script, rate limited after a few requests |
| Reddit | Read a sub's top posts for the month and note who posts original content: weekly "new on streaming" threads, [OC] charts on r/dataisbeautiful, episode-ranking posts on r/television. | Profile karma, logged in | Profile post history | Reddit chat or a site the user links. Many subs forbid soliciting users, so read the rules first. | Browser. Reddit JSON and old.reddit.com refused scripted requests. |
| Podcasts | Apple's free chart feeds by genre: `https://itunes.apple.com/{country}/rss/toppodcasts/limit=200/genre={id}/json`, with TV & Film 1309, TV Reviews 1561, After Shows 1562, Film Reviews 1563, Film History 1564, Film Interviews 1565. Ranks 40 to 200 are where small shows sit. The iTunes Search and Lookup API gives each show's RSS feed. | No public download counts exist. Use proxies: chart rank in its subgenre, the hosts' social follower counts, and episode count. Listen Notes' free API (150 requests a month) does not include Listen Score or global rank; those are paid fields. Podchaser's audience estimates and contacts sit in its paid tier (not verified). | The latest `pubDate` in the RSS feed | The contact page on the show's website, or the listener address the show invites in episodes. The `itunes:email` in a feed is the owner's technical address, not an invitation. | Script (Apple podcast web pages returned empty bodies after a few requests; the JSON feeds kept working) |
| Substack | The Film & TV category leaderboard as JSON: `https://substack.com/api/v1/category/public/76782/all?page=N` (category ids come from `/api/v1/categories`). Each entry has `freeSubscriberCount` (rounded, for example "5,000") and a finer `freeSubscriberCountOrderOfMagnitude` ("5.7K+"). Ten pages gave 250 publications. The publication search endpoint returned nothing without a login. | Leaderboard JSON, or the "Thousands of subscribers" line on the publication | `https://PUB.substack.com/api/v1/archive?sort=new&limit=3` | Reply to an issue, or the contact on the About page | Script |
| Ghost | Ghost Explore (`explore.ghost.org`) lists publications by category (Entertainment) and language, with subscriber counts on many entries. | Explore page per publication | The site's `/rss/` feed | The site's contact page | Script |
| Beehiiv | No public discovery directory was found; `beehiiv.com/discover` and `/explore` returned 404. Find Beehiiv newsletters through creators' bios and web search for `site:beehiiv.com`. | Not shown publicly (not verified) | The site's archive | Reply to an issue | Partial |

German-language specifics:

- Apple's German charts (`itunes.apple.com/de/rss/...`) are the richest German source. Independent series and film podcasts sit between ranks 5 and 200 of TV Reviews and Film Reviews, next to brand shows from big film portals and broadcasters.
- German YouTube results for "neu auf Netflix", "streaming tipps", and "serien tipps" were mostly faceless trailer compilations or channels that stopped posting years ago.
- German film newsletters on Substack and Steady are rare. The Substack Film & TV leaderboard's first 250 entries had no German publication.
- German AI-tool YouTubers who explain Claude connectors and ChatGPT apps are active and in range.

## 3. What the private list holds

The private candidate list (outside the repo, never committed) has 50 candidates. Each entry has the platform, a public profile link, audience size with the date and how it was measured, latest post date, what they cover, why GoodWatch fits, the best published contact channel (a link to the contact page, never a scraped address), and a fit score from 1 to 5.

| Platform (primary) | Candidates | English | German | Fit 5 | Fit 4 | Fit 3 | Fit 2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YouTube | 16 | 14 | 2 | 3 | 9 | 3 | 1 |
| Bluesky | 10 | 8 | 2 | 3 | 5 | 2 | 0 |
| Letterboxd | 3 | 3 | 0 | 0 | 0 | 2 | 1 |
| X | 2 | 2 | 0 | 0 | 2 | 0 | 0 |
| TikTok | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| Podcasts | 9 | 5 | 4 | 1 | 4 | 3 | 1 |
| Newsletters (Substack 8, Ghost 1) | 9 | 9 | 0 | 3 | 5 | 1 | 0 |
| Instagram, Reddit | 0 | | | | | | |
| **Total** | **50** | **42** | **8** | **10** | **25** | **12** | **3** |

Notes:

- Several Bluesky candidates also run their own newsletter on Substack or Ghost. Those newsletters are the better contact route and the likelier source of a followed link.
- Instagram and Reddit have no counted candidates. Instagram recency and Reddit profiles could not be checked without a logged-in browser, so finding candidates there is a job for you in the app, using the methods in section 2.
- Podcast audience sizes are estimates from chart rank, episode count, and the hosts' social counts. No podcast publishes download numbers.
- On YouTube, about 70 searches gave 888 channels. A script filter for 1,000 to 100,000 subscribers and an upload in the last month left 311, and a manual check for topic, voice, and views per video left 14 English channels.

## 4. What to offer (free only)

| Offer | Who it suits | Owner effort per creator | Licensing note |
| --- | --- | --- | --- |
| A custom cut of the streaming study for their country or region, for example their country's Netflix catalogue size against the US and against the top country | Data, map, international, and streaming-business creators; German creators ("Netflix Deutschland vs USA") | 30 to 60 min (a query against the study data plus a short method note) | Numbers and charts from the snapshot are GoodWatch's findings. Credit JustWatch for availability data and TMDB, as the study page does ([05](../backlinks/05-linkable-assets-pr.md#licensing-limits-that-shape-every-asset)). |
| The season and episode grid as an image for a show they cover | Episode rankers, recap and rewatch podcasts | 10 to 15 min | IMDb's non-commercial terms: an image with the line "Information courtesy of IMDb (https://www.imdb.com). Used with permission." is fine; never send a CSV of episode ratings. |
| Combined scores for a list they already publish (this month's new or leaving titles) | Streaming-guide newsletters and channels | 20 to 30 min | Quote Rotten Tomatoes and Metacritic scores as facts with the source named, short lists only |
| Early access to a feature (taste picks, imports, MCP tools, list cards) | Letterboxd-centric and AI-tool creators | 10 min | None |
| A quote from you as the solo developer, for example on why US Netflix ranks 50th of 55 | Newsletters and podcasts writing about streaming | 10 min | None |
| A chart they can embed or reuse with credit | Anyone covering the study | Done once on the study page | Opt-in only, brand anchor, nofollow inside any embed code ([05](../backlinks/05-linkable-assets-pr.md#how-to-do-it-safely)) |

Do not offer money, paid promotion, subscriptions, merchandise, affiliate deals, or a "featured creator" badge that links back. Do not make any offer depend on a mention or a link.

## 5. Disclosure and link rules when you give anything

| Rule | What it says | What it means here |
| --- | --- | --- |
| FTC, "Disclosures 101 for Social Media Influencers" | Disclose a "financial relationship" with a brand, and financial relationships "aren't limited to money": free or discounted products or services count. Disclose "even if you think your evaluation is unbiased". The disclosure must be "hard to miss", in the video itself and not only the description. US law applies to posts from abroad if it is "reasonably foreseeable" they affect US consumers. | Custom data and early access are services of value. A creator who features GoodWatch after receiving them should say so ("GoodWatch gave me this data"). A visible on-screen credit for the data source does that job. |
| FTC Endorsement Guides, 16 CFR Part 255 (revised 2023) | The advertiser is responsible too: give endorsers guidance and don't ask them to hide the connection. | Tell each creator in the first message that they owe you nothing, can criticise freely, and should credit the source. Never suggest they leave the credit out. |
| YouTube | "If you feature branded content, sponsorships, endorsements, or other commercial relationships in your videos, you have to let YouTube know by selecting the paid promotion button." | Data given for free is usually not a "paid promotion". If the video is about GoodWatch rather than just citing its data, the creator decides whether to tick the box. Don't advise them against it. |
| TikTok branded content policy | Branded content is material that "promotes or reviews a third-party brand or its products or services" made "in exchange for payment or any other incentive". Creators must "enable the commercial content disclosure toggle". | Same as YouTube: a video built around GoodWatch after early access counts as an incentive. |
| Meta (Instagram, Facebook) branded content policy | Requires the paid partnership label for content made in exchange for value (not verified: the policy page didn't render for me). | Same approach. |
| Germany, § 5a (4) UWG | Not marking a commercial purpose is unfair. Acting for another company has no commercial purpose if the person gets "kein Entgelt oder keine ähnliche Gegenleistung", and receiving one is presumed unless the person shows otherwise. | For German creators, free data or early access can count as an "ähnliche Gegenleistung", so they may label the post "Werbung" or "Anzeige". Say plainly what you gave and that labelling is their call. |
| Google link spam policy (updated 2026-08-28) | Link spam includes "Exchanging goods or services for links" and "Sending someone a product in exchange for them writing about it and including a link". Paid or sponsored links are fine "as long as they are qualified with a rel="nofollow" or rel="sponsored" attribute". | Ask for nothing about links: not in the pitch, not in the follow-up, not as a "credit with link" condition. If a creator chooses to link, that is an editorial link. If any link is ever part of a deal, it must be `rel="sponsored"`. Details in [06-google-policies.md](../backlinks/06-google-policies.md). |

## 6. Outreach etiquette

### Rules that keep you from being blocked or reported

- Send one personal message per creator. Mention one specific video, episode, or post of theirs and why the GoodWatch data fits it. No templates sent as-is.
- Use only the contact channel the creator publishes for this kind of message: the YouTube About page business email, a website contact form, a newsletter reply, the address a podcast invites for listener mail. Don't hunt down private addresses.
- No mass DMs. X lists "Sending bulk, aggressive, high-volume unsolicited replies, mentions, or direct messages" as spam, and Bluesky's guidelines forbid spam and manipulating "social signals" ([03-social.md](../backlinks/03-social.md#1-per-platform-findings)).
- No follow-unfollow and no like sprees. Letterboxd's terms forbid following or liking excessively "to generate reciprocal follows or likes" ([02-reddit-forums.md](../backlinks/02-reddit-forums.md#letterboxd)).
- On Reddit, read the sub's rules first; many forbid soliciting users by chat. Reddit outreach is the last resort.
- Send at most one short follow-up, a week or more later, and only if the first message had a concrete, time-bound offer (for example the grid before a finale). Silence is a no.
- Space messages out: five to ten a week at most, so each one gets real attention.
- Keep a short note of who you contacted, when, and their answer. Remove people who say no, and never contact them again.

### Email law, plainly

| Recipient | Law | What it says | What you do |
| --- | --- | --- | --- |
| Germany (consumers and businesses) | § 7 (2) Nr. 2 UWG | An unreasonable nuisance is always assumed "bei Werbung unter Verwendung ... elektronischer Post, ohne dass eine vorherige ausdrückliche Einwilligung des Adressaten vorliegt". Unlike phone calls, there is no "presumed consent" route for businesses. The BGH held that a published email address gives no implied consent to commercial requests outside the recipient's own typical offering (BGH, 17 July 2008, I ZR 197/05, "FC Troschenreuth"). The BGH also treats requests that look harmless as advertising: a customer-feedback request inside an invoice email was direct advertising (BGH, 10 July 2018, VI ZR 225/17). | Treat a pitch about GoodWatch as advertising, even though GoodWatch is free. Don't cold email German creators. Contact them only through a channel they explicitly invite for suggestions or tips, or start in public (a useful reply under their post) and let them get in touch. The practical risk is a cease-and-desist letter (Abmahnung) with legal costs. |
| Other EU countries | GDPR Art. 6 (1) (f) and Art. 14, plus national ePrivacy rules | Writing to a named person's business address is processing personal data. Legitimate interest can cover a one-off relevant message, and Art. 14 requires telling the person where you got the address and that they can object. National email rules differ (not verified per country). | Say in the message where you found the address and that one reply "no" ends it. Keep the private list small and delete entries you no longer need. |
| United Kingdom | PECR, ICO guidance | "You can email or text any corporate body", but "Sole traders and some partnerships are treated as individuals", and individuals need "specific consent". | Most UK creators are sole traders: treat them like German recipients. A creator operating as a limited company can get one relevant email. |
| United States | CAN-SPAM, FTC compliance guide | It "makes no exception for business-to-business email". Commercial email needs accurate headers and subject, a clear statement that it is an advertisement, "a valid physical postal address", and an opt-out you honour "within 10 business days". | A one-to-one pitch can go out, with your real name, a postal address, and a line such as "Reply 'no' and I won't write again". |

### Outreach template (under 120 words)

Adapt every line to the creator. The bracketed parts are where the specific reference goes.

> Subject: Data for your [show/topic] video, no strings
>
> Hi [name],
>
> I liked your [specific video/episode], especially [one concrete detail].
>
> I'm the solo developer of GoodWatch, a free movie and TV site. It tracks where titles stream in 139 countries and shows ratings for every episode. For [their topic] I can send you [one concrete offer: the episode grid for Slow Horses, or your country's Netflix catalogue next to the US].
>
> It's free, with no obligation to mention or link anything. If you use it, a "Data: GoodWatch" credit is all I'd ask. Criticism welcome.
>
> I found your address on [page]. Reply "no" and I won't write again.
>
> [Your name], [postal address]

That is about 110 words with the brackets filled in briefly. For German creators, use it only where they invite messages, and write it in German.

## Recommended moves

Ranked by value per owner hour. Hours are estimates.

| Rank | Move | Owner hours | Link type | Why it ranks here |
| --- | --- | --- | --- | --- |
| 1 | **Build the offer kit once**: a per-country table from the study data, a way to export one show's grid as an image with the IMDb line, two sentences about GoodWatch and you, and a contact log | 2 to 3 h | None directly | Every later pitch drops from about an hour to 15 minutes. Without it, outreach doesn't fit your time budget. |
| 2 | **Pitch the data and map creators and the streaming-business newsletters** in the private list, with one custom country cut each | 3 h for about 6 creators | Followed from newsletter archive pages (Substack post links had no `rel` in the HTML checked); YouTube links are redirect-wrapped (nofollow not verified) | Their audiences cite and share charts, and these creators already make the exact content the study feeds. A newsletter issue that cites the study is the closest thing to a press link this channel gives. |
| 3 | **Send the episode grid to episode rankers and recap or rewatch podcasts** a few days before a finale or new season of a show they cover | 2 h for about 8 creators | Mostly none (YouTube redirect, podcast show notes vary, not verified) | The grid is made for their format and costs you 15 minutes per show. It brings visitors who track shows, which is the audience for episode tracking. |
| 4 | **Offer combined scores to streaming-guide newsletters** for their next "worth watching" or "new this week" issue | 1.5 h for about 4 newsletters | Followed on Substack and Ghost archives (Ghost not verified) | Weekly newsletters need fresh data every week. One good fit can become a recurring credit. |
| 5 | **Give AI-tool YouTubers early access and a short demo script for the MCP server** | 1.5 h for about 3 creators | Redirect-wrapped description links | GoodWatch is a rare consumer MCP app with visual cards, which makes an easy demo. Brings Claude and ChatGPT users, not film fans. |
| 6 | **German podcasts and Bluesky accounts, through invited channels only**: offer the German catalogue against the US | 1.5 h for about 5 creators | Show-note links on independent sites vary (not verified) | You can speak to them in German, and the German catalogue numbers are new to them. Legal care rules out cold email, which limits reach. |
| 7 | **Bluesky film and TV creators: public replies first**, with a data point that adds to their post, then one message if they engage | 1 h a week, ongoing | None (JavaScript-rendered links) | Low risk and builds recognition, but slow. Fits the Bluesky routine from round 1. |

## Skip list

| Skip | Why |
| --- | --- |
| Paid shout-outs, sponsored videos, affiliate deals | Outside the budget; any link would have to be `rel="sponsored"`, and IMDb's non-commercial terms argue against paid promotion of pages built on its data |
| Gifting subscriptions or merchandise for coverage | A gift tied to coverage with a link is Google-listed link spam and triggers disclosure duties for little gain |
| Mass DMs, bulk email tools, scraped address lists | Named spam on X and Bluesky; unlawful for German and most UK creators; gets accounts limited |
| Follow-unfollow and like sprees to get noticed | Named in Letterboxd's terms and X's and Bluesky's spam rules |
| Faceless trailer and "top 10" compilation channels | Many subscribers, few views per video, no person to talk to, often reused footage |
| Creators above about 100,000 followers | They get many pitches a day, rarely answer, and often route requests through agencies that expect payment |
| Reddit DMs to power users | Many subs forbid solicitation, and a cold chat from an account with a product link reads as spam |
| Paid creator databases and contact finders | Outside the no-paid-tools rule; the free methods above were enough for a 30 to 50 creator list |
| Asking for a "credit with link" in exchange for data | Exactly the "exchanging goods or services for links" pattern Google names |

## Sources

All read 2026-10-21.

Law and policy:

- Gesetz gegen den unlauteren Wettbewerb, § 7: https://www.gesetze-im-internet.de/uwg_2004/__7.html
- Gesetz gegen den unlauteren Wettbewerb, § 5a: https://www.gesetze-im-internet.de/uwg_2004/__5a.html
- BGH, Urteil vom 17. 7. 2008, I ZR 197/05, "FC Troschenreuth": https://lexetius.com/2008,2034
- BGH, Urteil vom 10. 7. 2018, VI ZR 225/17 (customer-feedback email is advertising; summary via search results and law-firm write-ups, full text not read): https://www.it-recht-kanzlei.de/kundenzufriedenheitsanfrage-rechnung-bgh.html
- FTC, Disclosures 101 for Social Media Influencers: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- FTC, CAN-SPAM Act compliance guide for business: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- FTC Endorsement Guides, 16 CFR Part 255: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255 (not re-read this session)
- ICO, electronic mail marketing under PECR: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/
- GDPR text (Art. 6, 14, 21): https://eur-lex.europa.eu/eli/reg/2016/679/oj (not re-read this session)
- Google spam policies, link spam (last updated 2026-08-28): https://developers.google.com/search/docs/essentials/spam-policies#link-spam
- YouTube Help, branded content restrictions and disclosure labels: https://support.google.com/youtube/answer/154235
- TikTok branded content policy: https://www.tiktok.com/legal/page/global/bc-policy/en
- Meta branded content policies (page did not render): https://www.facebook.com/business/help/221149188908254
- Listen Notes API pricing (free plan: 150 requests a month, no Listen Score or global rank): https://www.listennotes.com/api/pricing/

Discovery tools and endpoints:

- Substack categories and Film & TV leaderboard: https://substack.com/api/v1/categories and https://substack.com/api/v1/category/public/76782/all?page=0
- Ghost Explore, Entertainment: https://explore.ghost.org/entertainment
- Apple chart feeds: https://itunes.apple.com/us/rss/toppodcasts/limit=200/genre=1561/json (and genres 1309, 1562 to 1565; country code `de` for Germany)
- iTunes Search and Lookup API: https://itunes.apple.com/search?media=podcast&entity=podcast&term=... and https://itunes.apple.com/lookup?id=...
- Bluesky public API: https://public.api.bsky.app/xrpc/app.bsky.graph.searchStarterPacks, app.bsky.actor.getProfile, app.bsky.feed.getAuthorFeed, app.bsky.actor.searchActors
- Social Blade free channel pages: https://socialblade.com/youtube/handle/HANDLE
- Letterboxd popular reviewers: https://letterboxd.com/reviewers/popular/
- Round 1 reports: [03-social.md](../backlinks/03-social.md), [05-linkable-assets-pr.md](../backlinks/05-linkable-assets-pr.md), [06-google-policies.md](../backlinks/06-google-policies.md), [02-reddit-forums.md](../backlinks/02-reddit-forums.md)

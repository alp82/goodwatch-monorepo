# Launch platforms and directories for GoodWatch

Research date: 2026-10-18. All "accessed" dates below are 2026-10-18 unless a page date is given.

## How link types were checked

- Where a site served plain HTML to `curl`, I downloaded a live listing page and read the `rel` attribute on the outbound product link. These are marked **verified (live HTML)**.
- Where Cloudflare blocked `curl` (AlternativeTo, There's An AI For That, Launching Next, Uneed), I used the Wayback Machine's raw capture (`id_` mode) of a listing page. These are marked **verified (archived HTML, capture date)**.
- Server HTML can differ from what JavaScript renders later. Google renders JavaScript, so a link that only appears after JS may still count. Treat every "verified" as "verified in server HTML".
- `rel="ugc"` and `rel="sponsored"` are hints to Google, like `nofollow`. None of them passes reliable link equity.
- Numbers on traffic are anecdotes from individual founders. Each is labeled with its date. None is a controlled measurement.

---

## Hacker News (Show HN)

**Rules summary (primary sources)**
- Show HN is for "something you've made that other people can play with". It must be ready for people to try. Blog posts, sign-up pages, newsletters, lists, landing pages and fundraisers are off topic. Routine feature releases usually do not qualify, a major overhaul may. Make it easy to try, "ideally without signups or emails". (showhn.html)
- "Don't ask friends to upvote or comment." (showhn.html)
- "Please don't use HN primarily for promotion." Posting your own work part of the time is fine. "Don't solicit upvotes, comments, or submissions." No generated text in posts. Titles: no uppercase tricks, no exclamation marks, no site name. (newsguidelines.html)
- **New in 2026: Show HN is restricted for unfamiliar accounts.** The page https://news.ycombinator.com/showlim says: "We're temporarily restricting Show HNs because of a massive influx, mostly by users who aren't yet familiar with the site or its culture... become a good contributor, and then it will be fine to post an occasional Show HN." A moderator comment dated 2026-10-02 links to this page and says they "had to put some barriers in place" because of a flood of Show HNs from new accounts. The exact threshold (karma, account age, comment count) is not published (not verified).
- Reposts: "a small number of reposts is ok" if the story has not had significant attention in about a year. "Please don't delete and repost." (newsfaq.html)

**Removal and penalty triggers**
- Voting rings. The FAQ: "We penalize or ban submissions, accounts, and sites that break this rule." A moderator wrote in 2014 that a Show HN "set off the voting ring detector" and that "even when we restore a post's rank, other penalties for ring-voting still apply." A 2014 comment adds that creators' attempts to game it are usually crude and get caught.
- User flags, anti-abuse software, and moderator action all lower rank (newsfaq.html).
- Show HN posts from accounts the new restriction applies to are rejected outright (showlim, moderator comment 2026-10-02).
- Being on HN "primarily for promotion" (an account that only posts its own links) is against the guidelines.

**Second-chance pool**
- Moderators and reviewers pick overlooked older submissions and software "lobs it randomly onto the lower part of the front page". Users can suggest stories by email to HN staff (address in the site footer). Staff say "It's fine if it's your own article, but we like it better when it's just something you ran across." Staff also email submitters to invite reposts, so an email in the HN profile helps. (Moderator post, 2021-04-30, item 26998309)

**Link type: nofollow until a story gets votes. Verified (live HTML).**
- On 2026-10-18 I fetched /show, /shownew and /news and read every story link. Every story with 8 points or fewer had `rel="nofollow"` (all 30 on /shownew except one, 16 of 30 on /show). Every story with 11 points or more had no `rel` attribute, so it is a followed link. The lowest followed story had 11 points; the highest nofollow one had 8. So HN removes nofollow somewhere around 9 to 11 points. The exact rule (points, karma, or moderator action) is not published (not verified).
- Comment links: not checked in this run (not verified).

**How hard it is to clear that bar (my own count from the HN Algolia API)**
- 15,336 Show HN posts from 2026-06-18 to 2026-10-16, about 128 a day.
- Share reaching 5 points: 18.7%. 10 points: 8.4%. 20 points: 5.1%. 50 points: 2.9%. 100 points: 1.6%. Median: 2 points.
- Movie-site Show HNs since 2024 (Algolia search "movie", Show HN tag): a streaming-availability finder got 335 points and 165 comments (2024-04-30); an IMDb SQL movie finder got 129 points (2024-11-05). Most movie recommenders, mood pickers and "where to watch" sites got 4 to 10 points, for example a global where-to-watch site with 6 points (2025-06-17) and an AI movie agent with 25 points (2026-01-19).
- Show HNs for MCP servers: median 7 points in a sample of 200 since 2025; 36% reached 11 points. The best ones are developer-facing (reverse engineering, WhatsApp, Apple Health).

**Free vs paid:** free. No paid options.

**Expected traffic (anecdotal)**
- A blogger's year of HN front-page traffic (published 2025-01-22, Plausible data): top post 9.7k visitors, middle 650 to 815, lower 50 to 150. Bounce about 94%. (vincentschmalbach.com)
- A wearable startup's Show HN (date of post not given, launch day Oct 13): about 6k page views and 500+ unique visitors from HN. (Search-result summary of an Indie Hackers post; page not fetched, not verified.)
- A comment mentioning a product on a front-page thread drove 390 visits; the author's own Show HN for another product drew about 100 visits. (Same source, not verified.)
- For a Show HN that stays under 10 points, expect a handful to a few dozen visits (not verified; inferred from the 2-point median).

**Timing (my own count, Show HN posts 2026-06-18 to 2026-10-16, share reaching 10 points)**
- Weekday barely matters: Sunday 9.6% and Monday 9.3% were best, Friday 7.6% worst.
- Hour matters more. 15:00 to 18:00 UTC: 10.2%. 21:00 to 24:00 UTC: 10.1%. 00:00 to 03:00 UTC: 9.9%. 06:00 to 09:00 UTC: 4.6% (worst). Posting during European morning is the weakest slot.
- This is correlation in one four-month window, not a causal result.

**Prerequisites**
- An established HN account with a real comment history, so the Show HN restriction does not block it. The owner should check whether their account can post a Show HN well before launch day.
- Something people can try without signing up. GoodWatch's discover, title and person pages already work for visitors, which fits. The MCP server needs an AI client; a Show HN for it should link a page that shows it working without setup.
- A short first comment by the maker: what it is, why it was built, how it works, what is unfinished.

**Angles that fit HN for GoodWatch**
- The open-source repo with a technical story (for example combining IMDb, Rotten Tomatoes and Metacritic scores, the per-title analysis pipeline, or MCP poster cards rendered inside ChatGPT and Claude). HN rewards the "how" more than the "what".
- A plain "where to stream plus all the scores" pitch has a weak track record (see the counts above), unless it has a distinct hook.
- Use one Show HN for the product. Save other angles for regular submissions of real write-ups (a blog post about how something was built can be a normal submission, not a Show HN).

**Do**
- Post from the owner's own long-standing account, 14:00 to 17:00 UTC (7 to 10 am US Pacific).
- Stay in the thread for the first few hours and answer every question plainly.
- Put an email in the HN profile so staff can invite a repost.
- If it sinks but was good, a single repost after some time is allowed, or a suggestion to staff for the second-chance pool.

**Don't**
- Don't share the link asking for upvotes, in any channel, or tell friends to comment.
- Don't use AI-written text in the post or comments.
- Don't delete and repost.
- Don't post with a new or quiet account.

**Sources**
- https://news.ycombinator.com/showhn.html (accessed 2026-10-18)
- https://news.ycombinator.com/newsguidelines.html (accessed 2026-10-18)
- https://news.ycombinator.com/newsfaq.html (accessed 2026-10-18)
- https://news.ycombinator.com/showlim (accessed 2026-10-18)
- Moderator comment on Show HN barriers: https://news.ycombinator.com/item?id=49937916 (2026-10-02)
- Ask HN thread "Please restrict new accounts from posting": https://news.ycombinator.com/item?id=47300329 (March 2026)
- Second-chance pool post: https://news.ycombinator.com/item?id=26998309 (2021-04-30)
- Voting ring comments: https://news.ycombinator.com/item?id=7642186 and https://news.ycombinator.com/item?id=7533791 (April 2014)
- Live HTML of https://news.ycombinator.com/show, /shownew, /news (fetched 2026-10-18)
- HN Algolia API, https://hn.algolia.com/api (queried 2026-10-18)
- https://www.vincentschmalbach.com/analyzing-a-year-of-hacker-news-traffic/ (2025-01-22)

---

## Product Hunt

**Rules summary (primary sources)**
- Personal accounts only. "Company accounts cannot hunt or post products." New accounts must finish onboarding before posting. Hunting your own product is encouraged; "there's no discernible advantage to using a third-party hunter." (Help Center, 2025-05-28; PH launch FAQ)
- Days run on Pacific time; posts go live at 12:01 am PT. PH says 12:01 am PT "is the best time to launch for makers that are planning ahead". (Help Center; launch FAQ)
- Featuring (getting onto the homepage) is an editorial decision based on four criteria: useful, novel, high craft, creative. A launch does not need to score high on all four. Excluded: waitlists, directories, lists, templates, courses, events, commerce and deal sites, off-topic non-tech submissions, products "primarily focused on immediate monetization". "Our featuring decisions are final." (Featuring Guidelines, 2026-03-10)
- Unfeatured launches stay in the "All" feed and can still collect comments and upvotes (search-result summary of PH help pages, not opened directly).
- Relaunch: generally wait six months and have a significant update (search-result summary of the relaunch help page, not opened directly).

**Removal and penalty triggers**
- Asking for upvotes. PH's answer to "Can I ask my community/friends/family to upvote?" opens with "Please don't." Asking or paying for upvotes "may trigger the algorithm to drop the product in the ranks" or remove it from the homepage. (Help Center, 2025-02-10)
- "Ask for feedback, comments, opinions, help spreading the word, not for upvotes." Contests that reward upvotes are prohibited; repeat violations may get a product unfeatured. (PH "Sharing your launch" guide)
- Ranking uses points, not raw votes: "One upvote does not always equal one point." Vote authenticity is a factor. (Help Center, 2025-02-21)
- PH says it detects unusual voting patterns automatically and removes non-genuine votes (search-result summary of the fair-voting help article; not opened directly).
- Spamming communities you have not been part of before is called out as a mistake. (Sharing your launch guide)

**Link type: `rel="ugc"`, not a clean dofollow. Verified (live HTML).**
- On the Letterboxd product page, the "Visit website" button is `<a href="https://letterboxd.com/?ref=producthunt" rel="noreferrer noopener ugc">`. Other outbound links go through `producthunt.com/r/...` redirects, also `ugc`.
- So PH gives referral traffic and a discovery listing, but a `ugc` link, which Google treats as a hint, not an endorsement.

**Free vs paid:** launching is free. No paid fast lane found. Ads exist (not researched).

**Expected traffic (anecdotal)**
- A link-in-bio product (launched 2026-05-25, #2 of the day): 17,300 landing-page visits and 2,021 registrations over 22 days (own.page blog, via search summary; not opened).
- A form builder (2023-09, #1 of the day): 9.8k homepage visitors and 766 signups on launch day (Tally blog, via search summary; not opened).
- A survey republished on several sites (undated): 26.5% of launches got 500 to 1,000 users, 24.5% got 100 to 500 (MySignature survey, not verified).
- These are B2B or prosumer tools with existing audiences. No consumer movie-site retrospective was found (not verified for GoodWatch's category).

**Timing:** launch at 12:01 am PT so you get the full 24 hours. PH says "the best day to launch is the day on which you're most prepared". Weekend versus weekday competition claims in third-party guides were not verified.

**Prerequisites**
- A personal PH account that has been used for a while (comments, upvotes on other products) so it does not look like a throwaway (PH advises joining the community early; "account age" thresholds are not published).
- Gallery of at least two images, thumbnail without strobing, a full YouTube URL if using video, a tagline, and a maker first comment.
- Profile "About" filled in, since profile views rise on launch day.

**What wins:** products that are useful and well made, with a maker who answers comments in real time. Comments matter; PH says engagement and vote authenticity feed points.

**Do**
- Self-hunt. Schedule for 12:01 am PT. Be online for the first hours.
- Share the launch link and ask people to look and comment, never to upvote.
- Lead with the free, no-sign-up experience and the AI-app angle (MCP in ChatGPT and Claude), which fits the "novel" and "creative" criteria.

**Don't**
- Don't run vote exchanges, Slack or Discord upvote groups, or "upvote for upvote" deals.
- Don't post as a company account.
- Don't relaunch inside six months without a major update.

**Sources**
- https://help.producthunt.com/en/articles/479557-how-to-post-a-product (2025-05-28)
- https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines (2026-03-10)
- https://help.producthunt.com/en/articles/484938-how-is-the-homepage-ranked (2025-02-21)
- https://help.producthunt.com/en/articles/484935-can-i-ask-my-community-friends-family-to-upvote-a-product (2025-02-10)
- https://www.producthunt.com/launch/sharing-your-launch (accessed 2026-10-18)
- https://www.producthunt.com/launch/when-to-launch (accessed 2026-10-18)
- Live HTML of https://www.producthunt.com/products/letterboxd (fetched 2026-10-18)
- https://help.producthunt.com/en/articles/11869098-how-does-product-hunt-ensure-fair-voting-and-prevent-spam-or-vote-manipulation (seen in search, not opened)

---

## BetaList

**Rules summary (primary sources)**
- **No free option any more.** FAQ: "All submissions are paid. There is no free submission option." Prices are shown on the submit form (I could not see them without logging in). Payment is taken before editorial review; rejected submissions are refunded.
- Criteria: recently launched or unreleased; technology products only; a distinct landing page; visitors must be able to sign up, download or log in. Rejected: products with significant press coverage, products launched "weeks ago or longer", blogs and newsletters, template or default Bootstrap pages, free-hosting subdomains, direct app-store links.

**Removal and penalty triggers:** not accepted if it fails the criteria; the FAQ does not describe vote penalties.

**Link type: dofollow via a 301 redirect. Verified (live HTML) and stated by BetaList.**
- FAQ: "The 'Visit Site' button on your featured listing is a do-follow link." It routes through a 301 redirect.
- Live check on a listing: the "Visit Site" anchors to `/startups/<slug>/visit` have no `rel`; other anchors to the same redirect carry `rel="noopener nofollow"`. The redirect returns `301` to the product with `?ref=betalist`.

**Free vs paid:** paid only. Plans differ by speed and guaranteed newsletter inclusion.

**Expected traffic (anecdotal, mostly 2020 to 2021)**: launch days of 35 to 222 visitors and 7 to 76 signups were reported in Indie Hackers posts; one founder reported 400+ signups in the week featured (all via search summaries, not opened, not verified).

**Fit for GoodWatch:** low. It costs money (owner's budget is time only), and GoodWatch has been live for a while, which the "recently launched" rule may reject.

**Sources**
- https://betalist.com/criteria (accessed 2026-10-18, undated)
- https://betalist.com/faq (accessed 2026-10-18, undated)
- Live HTML of https://betalist.com/startups/wzrd and its /visit redirect (fetched 2026-10-18)

---

## Indie Hackers

**Rules summary:** I could not find a published guidelines page (/guidelines returned 404 on 2026-10-18). Self-promotion norms are not verified. The product database ("Add Your Product") and a daily "Build Board" with voting exist on https://www.indiehackers.com/products.

**Link type: nofollow. Verified (live HTML).**
- Product pages: the product's website link is `rel="nofollow noopener"` (two product pages checked).
- Post bodies: an external link in a post was `rel="nofollow"` (one post checked). A link in a post excerpt on a product page had no `rel` in server HTML; whether JS adds it later is not verified.

**Free vs paid:** posting and product pages are free. IH+ is a paid subscription (not researched).

**Expected traffic:** none found with numbers for consumer products (not verified). IH's audience is founders, not movie watchers. Its value for GoodWatch is a build-in-public write-up (for example "what 120 indexed URLs taught me about SEO for a solo site") that might be read and shared, not referral users.

**Sources**
- https://www.indiehackers.com/products (fetched 2026-10-18)
- Live HTML of two product pages and one post (fetched 2026-10-18)

---

## Uneed

**Rules summary (primary source: Uneed's own launch.txt and llms.txt for agents)**
- Submitting is free. Free accounts can have one scheduled launch at a time. Each product gets one free-line launch.
- Real landing page required; preview domains such as vercel.app and netlify.app are rejected.
- Products impersonating an AI model are rejected. Moderation can decline a product for an unfixable reason, and then it can never be relaunched.

**Free vs paid**
- Free waiting line: Uneed assigns the date, 30 to 150 days out. The line can be closed or full for five months.
- Fast-track: $14.99, date about two weeks out, always published, dofollow from an upvote score of 10.
- Skip the Waiting Line: $29.99, pick the date, permanent dofollow regardless of results.

**Link type: depends on launch-day score. Stated by Uneed; live listing not verified.**
- Free line, launch-day upvote score of 20 or more: published with a dofollow link. 10 to 19: published with a nofollow link. Below 10: returned to the dashboard and "can never rejoin the free line".
- The score is weighted by each voter's multiplier (streaks, Pro), so 20 points is not 20 people.
- The one archived listing I could read (2026-05-13 capture) was a paid ad slot with `rel="noopener nofollow"`, which says nothing about launch listings.
- No badge-back requirement was found in the launch rules (not verified on the live submit form).

**Removal triggers:** free-line score below 10 on launch day, moderation decline, AI-model impersonation. Uneed staff told a Trustpilot reviewer that it removes votes from accounts it judges fake (search summary, not opened).

**Expected traffic (anecdotal):** a 2026-05 Indie Hackers launch-day update reported #2 with 51 upvotes; no visitor count. One maker said Uneed got 40 upvotes and 3rd place and that Uneed's organic traffic is far below Peerlist's (Peerlist post, undated). Uneed's own ad page claims 9,500 clicks a month to product sites in total (marketing claim, not verified).

**Fit:** medium. Free and dofollow is possible, but a solo maker without a network may miss the 20-point bar, and a score below 10 burns the free line for good.

**Sources**
- https://www.uneed.best/launch.txt and https://www.uneed.best/llms.txt (accessed 2026-10-18)
- https://www.uneed.best/submit-a-tool (accessed 2026-10-18)
- Archived https://www.uneed.best/tool/raycast (capture 2026-05-13)

---

## Peerlist Launchpad

**Rules summary (primary sources)**
- Weekly cycle. Launches open each Monday and run for a week. For the first two days (Monday and Tuesday), projects appear in random order for equal exposure. No time of day or timezone is published.
- Only verified individual profiles can launch; the profile needs a real name and photo and must not represent a company. Since 2025 week 37, only verified users can launch (search summary of a Peerlist post; not opened).
- The project must be complete on the profile (name, tagline, cover image, demo link).
- Ranking is an aggregate of upvotes, comments, views, link visits and traction. "Only qualitative comments" count. Votes and feedback from verified profiles carry more weight. Top 3 get the weekly email, social posts and a badge.
- How to get verified, and whether verification costs money: not verified.

**Removal triggers:** "zero tolerance for spamming": messaging members you don't know to ask for upvotes, over-sharing the launch link on Scroll (Peerlist's feed), unsolicited "please upvote" replies under other posts. Violating projects "may be suspended". SEO agencies launching for clients are banned.

**Link type: not verified.** The launch pages render client-side, and I could not get a project URL to inspect. A third-party comparison says Peerlist links are nofollow (not verified).

**Free vs paid:** not stated in the help center pages I read (not verified).

**Expected traffic:** a #1-of-the-week story claims 650+ registrations within a week, but that may refer to Product Hunt (search summary, not verified). A third-party table estimates Peerlist's monthly traffic far above Uneed, Fazier and Microlaunch (not verified).

**Fit:** medium-low. Audience is developers and designers, not film fans. Worth it only if the owner already has or wants a Peerlist profile.

**Sources**
- https://help.peerlist.io/individual/launchpad/guidelines-faqs (accessed 2026-10-18)
- https://help.peerlist.io/individual/launchpad/frequently-asked-questions-about-spotlight-by-peerlist (accessed 2026-10-18)
- https://peerlist.io/launchpad (fetched 2026-10-18)

---

## Microlaunch

**Rules summary:** I found no rules or FAQ page (/faq returned 404). Launches run on a monthly leaderboard with Idea, Product and "Roasts" scores (homepage, accessed 2026-10-18).

**Free vs paid**
- Launch Pro: $39 with a code, normally $49. Pick your launch date, 30 days of visibility, two manual boosts, "Lifetime SEO with DR64+ dofollow backlinks".
- Launch Plus: $79 with a code, normally $99.
- A free route exists according to third-party reviews, but its wait and terms are unpublished (not verified).

**Link type: dofollow observed. Verified (live HTML) on two listings.** Both had `rel="noopener noreferrer"` with `?ref=microlaunch`. One page's embedded data said `is_premium:false` for the product and the other `true`, so a free listing may also be followed, but this is not confirmed.

**Expected traffic:** no numbers found. A third-party table estimates about 1k monthly visits to the site (not verified).

**Fit:** low to medium. Cheap to try if a free route exists, but the audience is makers.

**Sources**
- https://microlaunch.net/ and https://microlaunch.net/premium (accessed 2026-10-18)
- Live HTML of https://microlaunch.net/p/adviserry and https://microlaunch.net/p/ackcard (fetched 2026-10-18)

---

## DevHunt

**Rules summary (primary source: FAQ)**
- "Open source and focused only on tools for developers." Non-developer tools are not accepted; the homepage shows non-dev launches in a section marked "Not for developers, so not in the vote."
- Voting requires GitHub or Google sign-in. Weekly launches; the tools with most votes win the week.

**Free vs paid:** listing is free; launching costs $19 once; a boosted launch is $49.

**Link type:** FAQ: "Free listings get nofollow links", "paid launches get a permanent dofollow link". Verified (live HTML) on one listing: the main product link had `rel="noopener"` (followed); another outbound link on a different listing had `nofollow`.

**Fit for GoodWatch:** low. GoodWatch is a consumer site; the MCP server is for people using AI apps, not developers building things. A listing would likely be in the "not for developers" bucket with no vote and, if free, a nofollow link.

**Sources**
- https://devhunt.org/faq (accessed 2026-10-18)
- Live HTML of https://devhunt.org/tool/agilehero and https://devhunt.org/tool/atlarix-app (fetched 2026-10-18)

---

## Fazier

**Rules summary:** no rules or FAQ page found; the help center is a Notion page that did not render for me.

**Free vs paid (from /submit, accessed 2026-10-18)**
- Free (Basic): $0, "Reviewed & listed within 30 days". **Requires a link to Fazier on your homepage or footer**, plus a free embed badge.
- Lite: $29, publish now or later, "High-authority backlink for top 3 daily products", no backlink required.
- Premium: $49, guaranteed backlink.
- Super: $99 or $139 (the page lists both), dofollow stated.

**Link type:** live listing check: the main product link (`?ref=fazier`) had `rel="noreferrer"` or `rel="noopener"`, so followed. Whether that listing was free or paid is unknown. So the free tier is a reciprocal link: dofollow in exchange for a link back to Fazier.

**Fit:** low. A reciprocal "link to me and I link to you" deal is the kind of link scheme Google's spam policies describe as "excessive link exchanges" when done at scale (Google policy not re-checked in this run). One badge is low risk; many are not worth it.

**Sources**
- https://fazier.com/submit (accessed 2026-10-18)
- Live HTML of https://fazier.com/launches/y-line (fetched 2026-10-18)

---

## AlternativeTo

**Rules summary (primary source: FAQ)**
- Sign up, verify your email, then "Suggest new application". The queue is large: "We can't give you a date, and we can't tell you where in the queue your app is." A paid priority review (usually 1 to 2 business days) "moves you up the queue, it does not buy approval". Long-time contributors may be moved up for free.
- Often declined: content rather than software, single-purpose tools, thin wrappers around someone else's LLM, services, clones. Not accepted: apps not supporting English, unreleased apps, apps limited to specific regions.
- Descriptions must not contain addresses, phone numbers, emails or website links.
- Self-promotion: "Using user profiles to advertise products or software is not allowed." Promoting your listing on your own social channels is welcome.
- In 2026-09 AlternativeTo added embeddable badges that link to your listing (news post, via search summary; not opened).

**Removal and penalty triggers:** fake accounts liking or reviewing "may trigger the algorithm to drop it" or remove it from the front page; offering gifts or discounts for likes can drop rank; comments and reviews are pre-moderated.

**Link type: mixed. Verified (archived HTML).**
- Letterboxd listing (capture 2026-10-13): the "Official Links" website link has `rel="noopener"` (followed); the "Developed by" link has `rel="nofollow noopener"`.
- A small streaming site listing (capture 2025-05-18): website link `rel="nofollow noopener"`.
- So established listings may get a followed official link, small new ones a nofollow link. What triggers the change is not published (not verified).

**Free vs paid:** free listing; paid priority review optional (price not seen).

**Expected traffic:** no public numbers found (not verified). Its lasting value is that "Letterboxd alternatives", "JustWatch alternatives" and "Reelgood alternatives" pages rank in search and send steady, intent-rich visitors, and GoodWatch can be added as an alternative on each.

**Do:** submit once, add GoodWatch as an alternative to the few apps it truly replaces, keep the description factual, link the listing from your own site if you like.
**Don't:** ask friends to like it, create extra accounts, or post promotional comments.

**Fit:** high. Free, consumer audience, persistent search traffic.

**Sources**
- https://alternativeto.net/faq (accessed 2026-10-18)
- Archived https://alternativeto.net/software/letterboxd/about/ (capture 2026-10-13)
- Archived https://alternativeto.net/software/watchplaystream-com/about/ (capture 2025-05-18)

---

## SaaSHub

**Rules summary:** submit and verify your product (verification once every 3 months to stay eligible for the homepage). Free. Paid "featured listing" for premium placement. Ranking comes from comparison articles around the web; SaaSHub invites you to send links to independent posts comparing your product. Guest posts are free if they follow its guidelines. (FAQ)

**Link type: nofollow for normal listings. Verified (live HTML).**
- JustWatch, Reelgood, Trakt and Simkl listings: the hero "Website" link is `rel="nofollow"`. On the Letterboxd page the website button is a JavaScript `onclick`, not a link at all.
- Paid featured products (UTM `saashub-featured`) had one hero link with `rel=""` (followed) on their own page.
- So a dofollow link is only seen on paid featured listings.

**Fit:** medium. Free, covers the movie-streaming category (JustWatch, Reelgood are listed), nofollow but indexed "alternatives" pages can send some visitors.

**Sources**
- https://www.saashub.com/faq and https://www.saashub.com/submit (accessed 2026-10-18)
- Live HTML of saashub.com/justwatch, /reelgood, /trakt-tv, /simkl, /letterboxd, /screensnap-pro (fetched 2026-10-18)

---

## There's An AI For That (TAAFT)

**Rules summary:** AI-tool directory. Launch page (capture 2026-07-19) lists "Website only, Basic listing in our directory: $49 one-time review fee" and a $347 package with newsletter placement. No free submission path seen on that page. A third-party review says TAAFT occasionally picks one tool for a free monthly X thread (not verified).

**Link type:** archived ChatGPT listing (capture 2026-02-24): outbound links had no `rel` (followed). Whether a $49 listing gets the same is not verified.

**Fit:** low. Costs money, and GoodWatch is a movie site that uses AI, not an AI tool. The MCP angle is real but would be listed among thousands of AI tools.

**Sources**
- Archived https://theresanaiforthat.com/launch/ (capture 2026-07-19)
- Archived https://theresanaiforthat.com/ai/chatgpt/ (capture 2026-02-24)

---

## Futurepedia

**Rules summary:** the only submission route I could find is a "Verified Enhanced Listing + 1,000 Clicks" for $497 one-time (live page). Older free or $247 basic listings appear sold out or gone (third-party reports, not verified).

**Link type: nofollow. Verified (live HTML).** ChatGPT listing: the main link to chatgpt.com has `rel="nofollow"`.

**Fit:** low. Expensive, nofollow, AI-tool audience.

**Sources**
- https://www.futurepedia.io/enhanced and https://www.futurepedia.io/tool/chatgpt (fetched 2026-10-18)

---

## Launching Next

**Rules summary:** "Submitting to Launching Next is free, but if you want your startup to be considered for publication within 1-business day, we offer a $99 upgrade." Submissions are reviewed daily; you get an email if published. The form asks whether it is a side project. (Archived submit page, capture 2026-08-12)

**Link type:** not verified (Cloudflare blocked live fetch; no archived listing found).

**Fit:** low to medium. Free, low effort, small founder audience. Treat as a five-minute citation, not a traffic source.

**Sources**
- Archived https://www.launchingnext.com/submit/ (capture 2026-08-12)

---

## Tiny Startups

**Rules summary:** "Submit a Startup: Free". "Every listing is hand-approved." Popular startups get the homepage and a weekly newsletter "read by 25k+ startup founders" (Tiny Startups' own claim). Submit page claims you can "Earn a powerful DR 71+ do-follow backlink".

**Link type: nofollow observed. Verified (live HTML)** on two listings (`rel="nofollow noopener"` on the product link). The "earn" wording suggests dofollow is conditional (on popularity or paid upgrades); the condition is not published (not verified).

**Fit:** low to medium. Free, five minutes, founder audience.

**Sources**
- https://www.tinystartups.com/submit (fetched 2026-10-18)
- Live HTML of https://www.tinystartups.com/startup/warp and /startup/vigil (fetched 2026-10-18)

---

## OpenAlternative

**Rules summary:** a directory of open-source alternatives to proprietary software, listed by the proprietary product they replace. Submission requires sign-in; queue and pricing were not visible without login (not verified).

**Link type: nofollow. Verified (live HTML).** Immich listing: website and GitHub links are `rel="noopener nofollow"`.

**Fit:** low. GoodWatch's repo is public, but the site is used as a hosted service, not something people self-host. It may not count as an "alternative" in OpenAlternative's sense (not verified).

**Sources**
- https://openalternative.co/immich and https://openalternative.co/submit (fetched 2026-10-18)

---

## MCP directories (the most relevant "launch sites" for the MCP angle)

GoodWatch's MCP server is remote-only (a hosted URL). That decides which lists accept it.

### Official MCP Registry (registry.modelcontextprotocol.io)
- Remote-only servers can publish metadata without a package: `server.json` with a `remotes` array (`streamable-http` and a public URL). Publish with the official `mcp-publisher` CLI. Namespace must match your login: `io.github.<user>/...` with GitHub login, or a custom-domain prefix with DNS authentication. Description limit 100 characters. The registry is "in preview" and may reset data. No moderation process is described. (Registry quickstart doc)
- PulseMCP's submit page says it is paused and recommends listing on the official registry first, which it will "pick it up automatically" once submissions reopen.
- Link type: the registry is an API, not a web page with links. Its value is that other directories pull from it.

### awesome-remote-mcp-servers (GitHub list)
- The well-known awesome-mcp-servers list is only for servers with a public repo you install and run yourself; remote-only servers belong in awesome-remote-mcp-servers. Entry rules: public URL that answers an MCP `initialize` handshake (CI checks every PR), usable by anyone (public sign-up is fine), Streamable HTTP or SSE, **must be listed as a Glama connector** and carry its badge, one sentence under 120 characters. (CONTRIBUTING.md, accessed 2026-10-18)
- Movie and streaming servers are already present (for example a US streaming price server and several TMDB servers in the main list), so the category exists.
- Link type: GitHub user-content links are nofollow (long-standing GitHub behavior; not re-verified in this run because the README renders client-side). Value: developer referral traffic and the many sites that scrape this list.

### Glama connectors
- Required for the list above. Connector pages link to the provider's site with `rel="nofollow noreferrer"`. **Verified (live HTML)** on one connector page.
- Submission flow ("Add Server" / "Add Connector") and cost: not verified.

### Smithery
- Remote servers: go to smithery.ai/new, enter the public HTTPS URL; requires Streamable HTTP and OAuth if auth is needed. Smithery scans tools automatically, or reads `/.well-known/mcp/server-card.json` if auth blocks the scan. Note that Smithery's gateway proxies traffic to your server. (Smithery publish docs)
- Link type: dofollow observed. **Verified (live HTML)** on one server page: homepage link `rel="noopener noreferrer"`.

### mcp.so and mcpservers.org
- mcp.so: dofollow observed on one server page (homepage link `rel="noopener noreferrer"`; docs links `nofollow ugc`). Submission rules not verified.
- mcpservers.org: mixed; one listing's first repo link followed, other links `nofollow`. Submission rules not verified.

### PulseMCP
- Submissions paused as of 2026-10-18. A server page showed a followed link to the product homepage (`/servers/browser-use`, no `rel`). Will pull from the official registry later (per its submit page).

### Adjacent: AI app directories (not launch sites, but the main discovery path for the MCP angle)
- Claude Connectors Directory: remote MCP servers are submitted at claude.ai/directory/manage. Requirements include HTTPS, OAuth 2.0 if tools act on a user's account, `title` plus `readOnlyHint` or `destructiveHint` on every tool, docs, privacy policy, support contact, icon, a reviewer test account; any paid Claude plan can submit. (claude.com submission doc, accessed 2026-10-18). One developer reported 20 days to approval (dev.to, not verified).
- ChatGPT app directory: only third-party guides found (submit as an "app-only plugin" with the production MCP URL, domain verification, test cases, reviewer credentials). Not verified against OpenAI's docs.
- These give no backlinks but put GoodWatch in front of exactly the users the MCP server is for.

**Sources**
- https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx (accessed 2026-10-18)
- The awesome-mcp-servers repository on GitHub, CONTRIBUTING.md and README.md (accessed 2026-10-18; URL omitted because it contains a personal handle, search the repo name)
- The awesome-remote-mcp-servers repository on GitHub (same maintainer), CONTRIBUTING.md and README.md (accessed 2026-10-18)
- https://smithery.ai/docs/build/publish.md (accessed 2026-10-18)
- https://www.pulsemcp.com/submit (accessed 2026-10-18)
- Live HTML of a Glama connector page, a Smithery server page, an mcp.so server page, an mcpservers.org page, a PulseMCP server page (fetched 2026-10-18)
- https://claude.com/docs/connectors/building/submission.md (accessed 2026-10-18)

---

## Summary table

Effort is my estimate of the owner's hours, including assets and being present on launch day. Link value: "followed" means no nofollow, ugc or sponsored seen.

| Platform | Effort (hours) | Ban/downvote risk | Link value | Expected referral traffic | Prerequisites | Fit for GoodWatch |
|---|---|---|---|---|---|---|
| Hacker News (Show HN) | 4 to 8 (post, then a few hours in the thread) | Medium: voting-ring detector, flags, Show HN block for unfamiliar accounts | Followed only if it gets roughly 10+ points (8.4% of Show HNs do); nofollow otherwise | Usually a few dozen; a front-page hit can bring hundreds to thousands (anecdotal) | Established HN account with comment history; try-without-signup page; strong technical angle | High (if the account qualifies) |
| Product Hunt | 8 to 15 (gallery, copy, launch day) | Medium: vote manipulation gets ranked down or unfeatured | `ugc` (weak) | Hundreds to thousands if featured (anecdotal, B2B tools) | Personal account used for a while; assets; featuring is editorial | Medium-high |
| AlternativeTo | 1 | Low (if no fake likes) | Nofollow for small listings, followed for some established ones | Steady trickle from "X alternatives" pages (no numbers found) | Email-verified account; long free queue | High |
| Official MCP Registry | 1 to 2 | Very low | None directly; feeds other directories | Indirect | `server.json`, `mcp-publisher`, DNS or GitHub namespace | High |
| awesome-remote-mcp-servers + Glama connector | 1 to 2 | Low | GitHub nofollow; Glama nofollow | Small, developer audience | Public endpoint passing `initialize`; Glama connector listing | High |
| Smithery | 1 | Low | Followed (observed) | Small, developer audience | Streamable HTTP, OAuth or server card | Medium-high |
| mcp.so / mcpservers.org | 0.5 each | Low | Followed on mcp.so (observed); mixed on mcpservers.org | Small | None found | Medium |
| SaaSHub | 0.5 to 1 | Low | Nofollow (free); followed only on paid featured | Small | Verify product every 3 months for homepage | Medium |
| Uneed (free line) | 2 to 4 (launch day) | Low-medium: a score below 10 permanently loses the free line | Followed only at launch-day score 20+ | Small (no numbers found) | Real domain; wait 30 to 150 days | Medium |
| Peerlist Launchpad | 3 to 5 | Medium: strict anti-spam, suspensions | Not verified (third party says nofollow) | Small to medium, dev/design audience | Verified individual profile; complete project | Medium-low |
| Indie Hackers | 2 to 4 (write a real post) | Low-medium: promo-only posts tend to be ignored (not verified) | Nofollow | Small, founder audience | Account | Low-medium |
| Launching Next | 0.25 | Very low | Not verified | Very small | None | Low-medium |
| Tiny Startups | 0.25 | Very low | Nofollow observed; dofollow "earned" under unclear terms | Very small | None | Low-medium |
| Microlaunch | 1 to 2 | Low | Followed (observed on two listings, free status unclear) | Small (no numbers found) | Free route unclear; Pro $39 to $49 | Low-medium |
| Fazier (free) | 0.5 + badge | Low (one badge); reciprocal-link pattern if repeated | Followed in exchange for a link back | Small | Link to Fazier on your site | Low |
| DevHunt | 1 | Low | Nofollow free; followed only for $19 launch | Very small for a consumer site | Developer tool (GoodWatch is not) | Low |
| BetaList | 1 | Low | Followed (301 redirect) | Tens to low hundreds (2020 to 2021 anecdotes) | Paid only; "recently launched" rule | Low |
| There's An AI For That | 1 | Low | Followed on an archived listing | Unknown | $49 minimum | Low |
| Futurepedia | 1 | Low | Nofollow | Unknown | $497 | Low |
| OpenAlternative | 0.5 | Low | Nofollow | Small | Open-source alternative to a proprietary app | Low |

---

## Recommended top 4 moves from this family

1. **This week: list the MCP server in the MCP ecosystem (2 to 4 hours, near-zero risk).**
   Publish to the official MCP Registry under a goodwatch.app namespace (DNS auth), list it as a Glama connector, open a PR to awesome-remote-mcp-servers, and publish on Smithery and mcp.so. Smithery and mcp.so showed followed links; the rest are nofollow but get scraped and copied widely. If the owner is on a paid Claude plan, the Claude Connectors Directory submission is the highest-value adjacent step for real users, and it reuses the same metadata.

2. **This week: submit to AlternativeTo and SaaSHub (1 to 2 hours, low risk).**
   AlternativeTo's free queue has no published length, so start it now. List GoodWatch as an alternative to the specific apps it replaces (JustWatch, Reelgood, Letterboxd's discovery side, Rotten Tomatoes or Metacritic as score sources). These "alternatives" pages rank in search and keep sending people who are looking for exactly this. Add Launching Next and Tiny Startups the same day; they take minutes each.

3. **In 2 to 6 weeks: one Show HN from the owner's own established account (4 to 8 hours).**
   First confirm the account is not blocked by the Show HN restriction (showlim). If it is new or quiet, spend the next weeks commenting genuinely before posting. Lead with the open-source repo and a concrete technical story (for example how scores from three sources and the per-title analysis are combined, or MCP poster cards inside ChatGPT and Claude), linking a page anyone can use without signing up. Post between 14:00 and 17:00 UTC; skip the 03:00 to 12:00 UTC window. Tell nobody to upvote. Only about 1 in 12 Show HNs reach the roughly 10 points where HN drops nofollow, so treat a followed link as a bonus.

4. **About 2 to 4 weeks after HN: Product Hunt, self-hunted at 12:01 am PT (8 to 15 hours).**
   Use the HN feedback to polish first. Pitch the consumer story (all three scores, where to stream in your country, top-5 share cards) plus the "use it inside ChatGPT or Claude" hook, which fits PH's "novel" and "creative" criteria. The link is `ugc`, so the value is referral traffic and the listing page, not link equity. Ask people to look and comment, never to upvote. On the same day, put GoodWatch in Uneed's free waiting line for a date 1 to 5 months out, but only if the owner expects at least 10 weighted upvotes on that day, since a lower score permanently closes the free line for the product.

Skip for now: BetaList, There's An AI For That and Futurepedia (paid, budget is time only), DevHunt (developer tools only), Fazier's free tier (reciprocal link), OpenAlternative (fit unclear).

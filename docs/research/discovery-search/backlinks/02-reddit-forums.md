# Reddit, forums and community platforms

Research date: 2026-10-18. Research only. Nothing was posted, no accounts were created, nobody was contacted.

## How this was researched, and its limits

- reddit.com, old.reddit.com and the Reddit JSON endpoints block requests from this network ("blocked due to a network policy"). The live rules pages could not be read directly, and the bot challenge was not bypassed.
- Reddit Help Center articles were read in full via the Help Center's public Zendesk article API (the same text as support.reddithelp.com). Those quotes are primary and current (articles updated October 2026).
- Subreddit rules were read from the Arctic Shift archive of Reddit's own rules, wiki and subreddit API data (arctic-shift.photon-reddit.com). That text is Reddit's verbatim rule text, but it was **captured in January or February 2025**. Where possible it was cross-checked against third-party captures from September and October 2026 (rankhog.com, willitstay.com). Rows that have no 2026 cross-check are marked.
- Member counts come from the `subreddit_subscribers` field on each sub's newest archived post (posts dated 2026-10-17 or 2026-10-18).
- The table's source URL column gives the reddit.com rules page. The owner should open each one once before posting, since rules change and AutoModerator thresholds are usually unpublished.

## 1. Reddit sitewide rules and spam mechanics

### What the rules say now

- **Reddit Rules, rule 2:** "Abide by community rules. Participate authentically in communities where you have a personal interest, and do not spam or engage in disruptive behaviors (including content manipulation) that interfere with Reddit communities." Rule 5: "do not intentionally mislead others or impersonate an individual or entity in a deceptive manner." Enforcement runs from "asking you nicely" to temporary or permanent suspension and "removal of privileges from, or adding restrictions to, accounts." Source: https://redditinc.com/policies/content-policy (read 2026-10-18).
- **Spam policy:** spam is "repeated or unsolicited actions (whether automated or manual) that negatively affect users, communities, and/or Reddit itself." Examples include "Mass-posting repetitive content for the purpose of exposure", "Repeatedly posting unrelated/off-topic/link-farmed content", and "Using tools (e.g., bots, generative AI tools) that may break Reddit or facilitate the proliferation of spam." The how-to-avoid section: "Post authentic content into communities where you have a personal interest. If your contributions to Reddit consist primarily of links to a business that you run, own, or otherwise benefit from, please be thoughtful about the frequency of posting." It also says moderators decide what counts as spam in their own community. Source: https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam (updated 2026-10-18).
- **Promotion is not spam by default (mod-facing article):** "On Reddit, promotional content is not inherently considered to be spam. That said, some communities do have strict policies that disallow any kind of promotional content. Other communities abide by the 10% rule: only 10% of your posting and comment history in the community can be self-promotional in nature." Source: https://support.reddithelp.com/hc/en-us/articles/28012014962580-How-do-I-keep-spam-out-of-my-community (updated 2026-10-14).
- **Disrupting communities:** bans vote manipulation (multiple accounts, voting groups, "content from a domain"), ban evasion, report abuse, and "Being banned across several communities dealing with the same topics" or "Being repeatedly reported for violating community rules across several communities." Source: https://support.reddithelp.com/hc/en-us/articles/360043066412-Disrupting-Communities.
- **AI content:** generally allowed subject to community rules, but the policy prohibits AI content "that presents itself as human-generated" and asks posters to "include a tag (or other form of indication) disclosing that the content was generated or modified by AI." Source: https://support.reddithelp.com/hc/en-us/articles/41180423371156-Manipulated-Content-and-Misleading-Behavior.

### The 10% / 9:1 guideline: what it is now

- **Reddiquette** (still on the Help Center, updated 2026-10-18) says: "Feel free to post links to your own content (within reason). But if that's all you ever post, or it always seems to get voted down, take a good hard look in the mirror [...] you just might be a spammer. A widely used rule of thumb is the 9:1 ratio, i.e. only 1 out of every 10 of your submissions should be your own content." Reddiquette describes itself as "an informal expression of the values of many Reddit users, as written by users themselves." Source: https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette.
- **The old self-promotion wiki** (reddit.com/r/reddit.com/wiki/selfpromotion, the page many subreddit rules still link to) now opens with "This page is no longer updated. For more up to date information go here: https://www.reddithelp.com". Its text still says "10% or less of your posting and conversation should link to your own content" and "It's perfectly fine to be a redditor with a website, it's not okay to be a website with a reddit account." It also warns that asking for votes "in extreme cases can get your domain banned" and that sockpuppets "can get your domain or brand banned." Verified from a Wayback Machine capture dated 2026-09-28.
- **Conclusion:** 10% / 9:1 is no longer an official sitewide rule. It survives as a rule of thumb in Reddiquette and as an explicit rule in many subreddits (r/InternetIsBeautiful, r/LocalLLaMA, r/opensource, r/webdev; r/movies uses a stricter 20%-per-source rule). The official sitewide test is "authentic participation" and "frequency".

### Rate limits, shadowbans and suspensions

- **New-account rate limit:** "there's a limit to how often users can post and comment in a community. If you're brand new to Reddit and don't have a lot of karma yet, you may be hitting this spam filter." Source: https://support.reddithelp.com/hc/en-us/articles/204579879.
- **Karma minimums are per community:** "some communities require a certain amount of karma before allowing you to post there." Source: https://support.reddithelp.com/hc/en-us/articles/204511829-What-is-karma.
- **Shadowban:** Reddiquette warns that flooding the new queue means "your future submissions may be automatically blocked by the spam filter. Shadow banning (you can see your posts and votes, but no one else can) can, and will, take place in more severe cases." The Help Center calls the current form being "flagged for spam or inauthentic activity": "If your posts, comments, chat messages, and profile page aren't showing up as expected, your account might've been flagged". The fix is an appeal at reddit.com/appeals. Sources: https://support.reddithelp.com/hc/en-us/articles/360045309012 and the Reddiquette page above.
- **Suspension:** a banned account cannot vote, post, comment or chat. A permanent ban is shown on the profile; a temporary one is not. Appeals cover being "incorrectly associated with other accounts actioned for spam." Source: https://support.reddithelp.com/hc/en-us/articles/360045734911.

### Moderator filters that hit new accounts silently

- **Contributor Quality Score (CQS):** every account gets one of five tiers (Highest, High, Moderate, Low, Lowest), "based on a host of signals including past actions taken on a user's account, network and location signals, and steps a user has taken to secure their account (e.g. email verification)." Mods can use `contributor_quality` in AutoModerator; the Help Center's own example filters users with "< 5" subreddit karma and CQS below "moderate". Source: https://support.reddithelp.com/hc/en-us/articles/19023371170196.
- **Reputation filter:** filters content "by users who may be potential spammers, are likely to have content removed, or have unestablished accounts". It is informed by CQS, "karma, verification, and other account signals" and "does not filter based on the post content". Source: https://support.reddithelp.com/hc/en-us/articles/27441485903124.
- **Crowd Control:** collapses or filters content from users "who aren't trusted members within their community yet". High filtering catches "negative community karma and new accounts"; maximum filtering also catches "non-members". Source: https://support.reddithelp.com/hc/en-us/articles/15484545006996.
- **Ban evasion filter:** links accounts by "how users connect to Reddit and information they share with us", not by post content. Source: https://support.reddithelp.com/hc/en-us/articles/15484544471444.
- **Practical meaning:** a fresh, unverified account that posts a link on day one is likely to be filtered without any notice. Verify the email, join the communities, and earn karma inside each community before posting there.

### Domain-level blocking

- AutoModerator lets mods "automatically action any domains or phrases" (source: the keep-spam-out article above). r/movies says a self-promoter "will be banned and your website blacklisted."
- Reddit lists "Posting content that includes link redirects as a way to circumvent an existing domain block" as reportable spam, which confirms that domain blocks exist and that working around them is itself spam (same article).
- How Reddit decides a sitewide domain ban is not documented in the Help Center (not verified). The old wiki ties it to vote asking and sockpuppets. Assume a few spam reports from several subs can get goodwatch.app filtered everywhere, and that this is hard to undo.
- The old wiki suggests checking reddit.com/domain/goodwatch.app to see where the site is already being discussed. That page could not be loaded from here.
- **Reddit Pro** (free sign-up per redditforpros.com; price not verified) gives a verified domain owner a "Content" tab showing posts, communities, views and outbound clicks for the domain. Verification needs the account email to match the domain. Pro accounts follow the same rules. Sources: https://support.reddithelp.com/hc/en-us/articles/47619289307412 and https://support.reddithelp.com/hc/en-us/articles/24368958859668.

### Are Reddit links nofollow, and what are they worth?

- **Verified:** in a Wayback Machine capture of www.reddit.com/r/InternetIsBeautiful/ dated 2025-12-31, the outbound link on a link post carries `rel="noopener nofollow ugc"`. Comment and self-post links were not checked directly (not verified, but expected to be the same).
- Google treats nofollow and ugc "as hints about which links to consider or exclude within Search" and, for crawling and indexing, "nofollow will become a hint as of March 1, 2020." Source: https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify.
- **Value left:** (a) referral visits from people who click; (b) discovery, because Google crawls Reddit heavily and can follow a nofollow link as a hint, which matters for a site Google barely knows; (c) Reddit threads rank in Google for "site like X" and "where to watch X" searches, so a lasting helpful mention keeps sending clicks (not verified as a measured effect); (d) Reddit content is licensed to Google for AI use (Reuters, February 2024, about $60 million a year per anonymous sources; Google and Reddit confirmed the deal but not the price), so mentions may reach AI answers (not verified); (e) the biggest SEO win is indirect: bloggers and journalists who find a project on Reddit and write about it with followed links. Example: a viral r/dataisbeautiful IMDb episode heatmap led FlowingData to build and write up an all-shows heatmap tool ("after a graphic on Reddit inspired him", https://flowingdata.com/2021/10/05/heatmap-of-average-imdb-ratings-for-all-the-shows/), and Genbeta wrote up the TV Charts site, "inspired by r/dataisbeautiful" (https://www.genbeta.com/web/esta-web-nos-ayuda-a-visualizar-como-han-ido-evolucionando-puntuaciones-serie).

### What succeeds (evidence)

- Rules themselves reward value-first posts: r/webdev says "Think project, not product. Focus on the technical details of your project"; r/ClaudeAI asks for "a clear description of what was built, how Claude helped in detail"; r/selfhosted wants a written summary with any blog link; r/TrueFilm asks "If the link were removed, would it still be a good post?"
- Request subs reward answers, not links: r/MovieSuggestions allows links only to "neutral informative sources", bans IMDb and YouTube links, and bans site promotion outright. The way to help there is a short list of titles with one line each.
- Data posts travel furthest off Reddit (the FlowingData and Genbeta examples above).
- Many 2026 rule sets now ban LLM-written posts: r/webdev ("LLM generated posts or comments"), r/LocalLLaMA ("Completely/primarily LLM generated copy, code is not allowed"), r/cordcutters ("No AI generated posts"), r/mcp ("No AI generated slop"), r/movies (AI "trying to pretend it's a real user"). Posts must be written by the owner.

## 2. Per-subreddit table

Fit means fit for GoodWatch links or posts. "Warm-up" means a good place to participate without linking. Rules dates: "2025-01" means Reddit rule text archived in January 2025; "x-check 2026-09/10" means a third-party capture from that month agrees.

| Sub | Approx members | Self-promo allowed? | Special thread or day | Account age / karma rules | Link value | Fit | Source URL |
|---|---|---|---|---|---|---|---|
| r/movies | 37.7M | No. Spam is ">20% of their submissions coming from one source"; a username matching the site means ban plus "website blacklisted"; "Sharing Letterboxd accounts is not allowed"; AI posing as a user is banned. Text posts need 300+ characters. (2025-01, x-check 2026-09) | Official discussion threads for new releases (4 weeks after US release) | Not stated | Huge reach, but own links are effectively banned | Low | https://www.reddit.com/r/movies/about/rules |
| r/MovieSuggestions | 1.9M | No. "If you wish to be banned... promote your site/blog/article/channel/subreddit/etc., promote your app/company". Links only to "neutral informative sources" (TMDB, Letterboxd, Rotten Tomatoes, Wikipedia, ReelGood); IMDb and YouTube links auto-removed. Requests need 125+ characters. (2025-01, wiki 2024-12; no 2026 x-check) | Suggestion posts: one film, max one per 24 hours | Not stated | None for own links | High as warm-up, none for links | https://www.reddit.com/r/MovieSuggestions/about/rules |
| r/televisionsuggestions | 517k | No. "No Shilling. No self-promotion of any kind." Neutral sources only. (2025-01, no x-check) | None found | Not stated | None | Warm-up only | https://www.reddit.com/r/televisionsuggestions/about/rules |
| r/television | 18.2M | Discouraged. Wiki: follows Reddit spam guidelines; "If you are submitting content that is yours, be wary." Rec requests only in the weekly thread; where-to-watch questions are sent to JustWatch. (2025-01, wiki 2022-12; no x-check) | Weekly recommendation thread | Not stated | Low | Low | https://www.reddit.com/r/television/about/rules |
| r/ifyoulikeblank | 1.5M | No. "Self-Promotion is prohibited, no exceptions... This is an instaban rule". Links only from YouTube, Spotify, Apple Music, SoundCloud, IMDb or Letterboxd. (2025-01) | Title must start [IIL] or [IYL] | Not stated | None | Warm-up only | https://www.reddit.com/r/ifyoulikeblank/about/rules |
| r/cordcutters | 609k | No. "No spam, affiliate links, referral codes, self promotion, advertising... No surveys". "No AI generated posts." (2025-01, no x-check) | None found | Not stated | None for own links | Warm-up (answer streaming questions in text) | https://www.reddit.com/r/cordcutters/about/rules |
| r/netflix | 2.0M | No. "No Blogspam, Tubespam or Appspam... If you do it, we'll find it and when we do, you're banned... ask the mods first". (2025-01) | None | Not stated | None | Low | https://www.reddit.com/r/netflix/about/rules |
| r/NetflixBestOf | 11.6M | Not addressed. No rule list in the archive; sidebar asks posters to "link to the description page of the movie or show". (2025-02 sidebar, not verified now) | None | Not stated | Low | Low | https://www.reddit.com/r/NetflixBestOf/about/rules |
| r/TrueFilm | 652k | Only in threads. "Self-promotion posts are not allowed; they belong in 'Fun & Fancy Free' discussion threads." 360-character posts, 180-character comments. (2025-02) | Fun & Fancy Free threads on Monday, Wednesday, Friday | Not stated | Low | Low | https://www.reddit.com/r/TrueFilm/about/rules |
| r/flicks | 256k | Limited. "Is the primary purpose of this post/comment about engaging the community (good), or is it just to promote their content (bad)?" 100-character top-level comments. (2025-01) | None | Not stated | Low | Low | https://www.reddit.com/r/flicks/about/rules |
| r/Letterboxd | 577k | Only in threads. "Original content (LB lists/reviews, third-party OC etc.) is generally only permitted within our weekly threads", with mod exceptions for high-effort OC. (2025-01, no x-check) | Weekly threads; profile-sharing megathread | Not stated | Medium: Letterboxd users are the core audience, and the repo docs say GoodWatch imports Letterboxd ZIP exports | Medium | https://www.reddit.com/r/Letterboxd/about/rules |
| r/tipofmytongue | 2.7M | Not relevant. One question per post, [TOMT] title; OP must comment within 60 minutes. (2025-01) | None | Not stated | None | Skip | https://www.reddit.com/r/tipofmytongue/about/rules |
| r/dataisbeautiful | 21.8M | Yes for real OC. [OC] posts "must state the data source(s) and tool(s) used" in the first top-level comment; plain titles; no repost of popular posts within a month. Wiki: an author must have done the data work, the analysis and the visual; software screenshots are "not OC unless you are a creator of that software". (2025-01, no x-check) | US politics only Thursday (ET); personal data only Monday (ET) | Not stated | High if a chart gets picked up by blogs (see FlowingData example) | High | https://www.reddit.com/r/dataisbeautiful/about/rules |
| r/InternetIsBeautiful | 16.6M | Strict. "No Aggregations or Collections"; 90/10 rule; no sites requiring personal info; no AI-generated content (2026 wording: AI producing the primary content or driving functionality that doesn't need AI). (2025-01, x-check 2026-09) | None | Not stated | Very high if accepted | Low (GoodWatch aggregates ratings and uses LLM title analysis) | https://www.reddit.com/r/InternetIsBeautiful/about/rules |
| r/webdev | 3.3M | Only on Saturday. "Sharing your project... is limited to Showoff Saturday", correct flair required, "Commercial promotion... is not allowed. Think project, not product." "LLM generated posts or comments" removed. (2025-01, x-check 2026-09 and 2026-10) | Showoff Saturday; monthly career thread | Not stated | Medium: developer readers, some of whom blog | High (technical write-up) | https://www.reddit.com/r/webdev/about/rules |
| r/SideProject | 873k | Yes. The sub is "for sharing and receiving constructive feedback on side projects"; title format "[Project name] - [Short description]". No rule list published. (sidebar 2025-02, x-check 2026-09/10) | None | Not stated | Low to medium; very busy (about 350 posts a day per willitstay, not verified) | Medium | https://www.reddit.com/r/SideProject/about/rules |
| r/selfhosted | 858k | Only in set places. Projects younger than 3 months only in the "New Project Megathread"; Wednesday flaired dashboards and tools; posts "must be about self-hosting"; promoted apps "must be production ready and have docs". (x-check 2026-09 and 2026-10) | New Project Megathread; Wednesdays | Not stated | Medium | Low (GoodWatch is a hosted site, and self-hosting it is impractical, not verified) | https://www.reddit.com/r/selfhosted/about/rules |
| r/ClaudeAI | 1.2M | Yes, with conditions: built "with Claude/Claude Code or specifically for Claude BY YOU", clear description of how Claude helped, "free to try and say so", minimal promo language, no referral links. (x-check 2026-09) | "Built with Claude" flair (seen on recent posts); megathreads for performance and bugs | **"Posts on the feed now require OP karma>100"** (rule text, 2026-09 capture) | Medium to high: active builder audience | High (MCP server, built with Claude Code) | https://www.reddit.com/r/ClaudeAI/about/rules |
| r/ClaudeCode | 453k | Unknown: no rules archived; sidebar "An unofficial community centered around Anthropic's Claude Code tool." (not verified) | Unknown | Not stated | Medium | Medium (build-story angle) | https://www.reddit.com/r/ClaudeCode/about/rules |
| r/mcp | 125k | Yes, with disclosure. "Self-promotion is allowed with proper disclosure"; "use showcase tag"; "No waitlists" (only fully launched services); "No AI generated slop"; astroturfing means a permanent ban. (x-check 2026-10) | Showcase tag | Not stated | Medium: small but exactly on target | High | https://www.reddit.com/r/mcp/about/rules |
| r/ChatGPT | 11.7M | Only in the megathread. Posts focused on "advertising a single other LLM service" go to the "weekly self-promotional mega thread, which is pinned." (2025-01, x-check 2026-09/10) | Weekly self-promotion megathread | Not stated | Low (megathread posts get little attention, not verified) | Medium (GoodWatch MCP runs in ChatGPT) | https://www.reddit.com/r/ChatGPT/about/rules |
| r/LocalLLaMA | 852k | Limited. 1/10th rule, "Affiliation must be disclosed", links "directly to the source, such as GitHub or Hugging Face", don't flair your own project as News, no LLM-written copy. (x-check 2026-09/10) | None | Not stated | Medium | Low (only with a real local-model angle) | https://www.reddit.com/r/LocalLLaMA/about/rules |
| r/opensource | 390k | Yes, moderately. Use "Promotional" flair; under 10% ("We're a little more forgiving"); "Drive-by posts... may be removed". (2025-01) | None | Not stated | Medium; repo is MIT licensed | Medium | https://www.reddit.com/r/opensource/about/rules |
| r/coolgithubprojects | Not retrieved | Yes. "Github only: The projects you post all have to be hosted on Github". (sidebar 2025-02, x-check 2026-10) | None | Not stated | Medium for the repo, not the site | Medium | https://www.reddit.com/r/coolgithubprojects/about/rules |
| r/PleX | 416k | Yes after contributing. "everyone is allowed to promote their own sites and products however we require you to have already contributed... not to do it too often"; extension or app posts for major updates. (2025-01) | None | Not stated | Medium (repo has a Plex import route) | Medium | https://www.reddit.com/r/PleX/about/rules |
| r/trakt | 14k | Unknown; no rules archived (not verified) | Unknown | Not stated | Low | Low to medium (Trakt ZIP import) | https://www.reddit.com/r/trakt/about/rules |
| r/kodi | 157k | Only one archived rule: no piracy add-ons; legal Kodi use only. (2025-01) | None | Not stated | Low | Low (Kodi import) | https://www.reddit.com/r/kodi/about/rules |
| r/indiehackers | 197k | Once. "Users can self promote their product 1 time using the Self Promotion flair." (x-check 2026-10) | Self Promotion flair | Not stated | Low | Low | https://www.reddit.com/r/indiehackers/about/rules |
| r/IMadeThis | 52k | No stated policy; sidebar invites makers to "brag a little". (x-check 2026-10) | None | Not stated | Low | Low | https://www.reddit.com/r/IMadeThis/about/rules |
| r/alphaandbetausers | 50k | Yes for testable products. Tag stage and platform; no waitlist pages; "please take the time to test someone else's product as well." (sidebar 2025-02) | None | Not stated | Low | Low | https://www.reddit.com/r/alphaandbetausers/about/rules |
| r/streaming | 107k | No. It is for creators ("Creation, Not Consumption"); Plex, Roku and watching-a-show topics are removed. (2025-01) | None | Not stated | None | Skip (wrong audience) | https://www.reddit.com/r/streaming/about/rules |

Country streaming subs: r/CordcuttersUK (76 members), r/uktv (365) and r/UKstreaming (86) exist but are tiny or dead. r/StreamingBestOf and r/JustWatch returned no data, and r/BestOfStreamingVideo's last archived post is from 2018. No useful country-specific streaming sub was found. r/StreamingNetflix was not checked.

No subreddit above publishes an account-age minimum. Only r/ClaudeAI publishes a karma minimum (100). Unpublished AutoModerator karma and age filters are common, and the Help Center's own CQS example filters users under 5 subreddit karma. Expect a new account's link posts to be held for review or removed.

## 3. Other platforms

### Letterboxd

- **Terms of use** (last updated December 2025, https://letterboxd.com/legal/terms-of-use/): members must not "post spam or otherwise violate our community policy", "game the Service's mechanics", or follow or like excessively "to generate reciprocal follows or likes". Two clauses matter for GoodWatch: "You must not access or use the Service to build or operate a competing business" and no "robot, spider, scraper". GoodWatch should not use Letterboxd as a marketing channel, and it should keep Letterboxd data handling to user-uploaded exports, which is what the repo's import does.
- **Community policy** (https://letterboxd.com/legal/community-policy/): about civility, spoilers, plagiarism and TMDB vandalism. It does not mention links or self-promotion. The terms' spam clause covers that.
- **Links in profiles, lists and reviews:** Letterboxd profiles have a bio, and reviews accept text. Whether external links are allowed in reviews and lists, whether there is a website field, and whether links are nofollow could not be checked: Letterboxd pages return 403 from here (not verified).
- **Recommendation:** an owner's personal Letterboxd profile can mention GoodWatch in the bio. Do not post lists or reviews that exist to promote GoodWatch. HQ promotion policy beyond the terms was not found (not verified).

### Trakt

- forums.trakt.tv is a public Discourse forum and is active (new topics on 2026-10-17 and 2026-10-18). It has a "3rd Party" category with "Media Centers" (120 topics), "Mobile Apps" (51) and "Other: Anything cool you found on GitHub" (37). Data from https://forums.trakt.tv/categories.json.
- The forum guidelines page exists at forums.trakt.tv/faq (standard Discourse guidelines). Its text was not read in detail (not verified).
- **Fit:** the repo docs say GoodWatch imports Trakt history ZIP exports (docs/implementation/native-imports.md). One factual topic in 3rd Party > Other ("GoodWatch can import your Trakt export") fits the category's purpose. The audience is small. Discourse adds nofollow to user links by default (not verified for this forum).

### IMDb

- IMDb closed its message boards in February 2017, saying they were "no longer providing a positive, useful experience for the vast majority of our more than 250 million monthly users" (2017 press coverage, e.g. https://www.404techsupport.com/2017/02/06/imdb-message-boards/). No forum has come back.
- **Community Guidelines** (updated 2026-09-09): "No external URLs/links, including obfuscated links" and "No promotional, advertisement, or spam (e.g. personal/professional websites...)". These apply to "all content featured on IMDb profiles, including but not limited to; images, bios, and usernames." Source: https://help.imdb.com/article/imdb/new-features-updates/imdb-community-guidelines/G4G5SA8CHKB9QACM.
- Review guidelines (updated 2025-09-15 per search snippet, not opened) say markup is unsupported apart from linking names and titles.
- **Conclusion:** IMDb offers no link or community channel. Skip.

### Discord

- Discord's Community Guidelines (effective 2025-09-29): "Do not send unsolicited bulk messages (or spam) to others", no self-bots, and "Do not engage with our service in an inauthentic way." Self-promotion is left to each server. Source: https://discord.com/guidelines.
- Many movie and dev servers have a #self-promo or #showcase channel (not verified; server rules can only be read after joining).
- **Link value:** Discord messages are behind sign-in, so search engines cannot crawl them (reasoned, not verified). The value is a few referral clicks and feedback, not SEO.
- **Best bets** (not verified): the MCP community and AI-client communities for the MCP server, and Plex or Jellyfin community servers for the import feature. Read the rules and showcase channel first.

### Lemmy

- **lemmy.world c/movies** (14.4k subscribers, about 2.0k active users a month, from https://lemmy.world/api/v3/community?name=movies): rule 3: "Spam, self promotion, trolling, and bots are not allowed."
- **lemmy.world c/moviesuggestions** (2.3k subscribers, 23 active a month): links only to IMDb, TMDB or RT. Warm-up only.
- **lemmy.world c/selfhosted** (63k subscribers, 6.2k active a month): promotion needs active participation and an account "at least 30 days old"; a 10% rule across the whole account; AI use must be tagged and disclosed. Rules updated 2026-07-07 (https://lemmy.world/post/48725669). Same fit problem as r/selfhosted.
- **lemmy.world terms, section 7.0 Advertising** (https://legal.lemmy.world/tos/): "it is not intended to be used as a marketing channel for extensive commercial advertising or product promotion. Promoting or recommending products and services is generally allowed provided that... It is relevant to the community... It offers something of value... It is created for community engagement rather than being a one-way message".
- The lemm.ee movie and TV communities are dead (lemm.ee shut down; lemmy.world c/television redirects to a lemm.ee community with 1 active user).
- **Fit:** low. The audiences are small, but their rules are the clearest anywhere: 30 days and 10%.

## 4. Do and don't list, and a warm-up plan

### Do

- Use one account, run by the owner, with a verified email. Say "I built this" every time GoodWatch comes up. r/mcp and r/LocalLLaMA require disclosure, and Reddit's misleading-behavior policy covers hidden affiliation.
- Read each sub's rules page and sidebar on the day of posting.
- Write every post and comment yourself. Several subs ban LLM-written text, and Reddit requires AI content to be labeled.
- Lead with the thing the community cares about: the technical problem (r/webdev), how Claude helped (r/ClaudeAI), what the MCP server does and the design choices (r/mcp), the data and method (r/dataisbeautiful).
- Link to the exact page that answers the post (a title page, a chart, /use-with-ai), not the home page.
- Stay in the thread for the first few hours and answer every question.
- Space promotional posts at least a week apart, with a different angle and different text each time.
- Keep self-promotion under 10% of all activity on the account, counting comments.
- Check reddit.com/domain/goodwatch.app (or Reddit Pro's Content tab) to see where people already share the site.

### Don't

- Don't post GoodWatch links in r/MovieSuggestions, r/televisionsuggestions, r/ifyoulikeblank, r/cordcutters, r/netflix or r/movies. These are instant-ban or blacklist rules.
- Don't name the account after the site. r/movies bans for this and blacklists the domain.
- Don't create a second account, ask friends to upvote, or share the post anywhere with "please upvote". This is vote manipulation, the clearest route to a domain ban.
- Don't cross-post the same text to many subs on the same day. "Repeatedly posting the same or similar comments... across communities" is listed spam.
- Don't use link shorteners or redirects.
- Don't post a waitlist or a sign-up wall (r/mcp, r/alphaandbetausers, r/InternetIsBeautiful).
- Don't argue with mods about removals in public. Ask once, politely, by modmail.

### A realistic warm-up month

Goal: a normal-looking history, more than 100 karma (r/ClaudeAI's bar), membership and positive karma in the target subs (Crowd Control looks at both), and no GoodWatch links at all.

- **Week 1:** create or reuse the personal account and verify the email. Join r/MovieSuggestions, r/televisionsuggestions, r/cordcutters, r/Letterboxd, r/mcp, r/ClaudeAI, r/webdev and r/dataisbeautiful. Each day, write 2 or 3 useful comments in request threads: three or four titles, a line on why each fits, and where it streams in one or two countries (typed out, no links). About 15 to 20 minutes a day.
- **Week 2:** keep up the request answers. Add 3 or 4 technical comments in r/mcp and r/ClaudeAI on other people's projects (questions, bug reports, honest feedback). Make one non-promotional text post, for example a genuine MCP design question.
- **Week 3:** comment in r/webdev threads that match real experience: Remix, OG images, performance. Comment on one or two Showoff Saturday posts by others. Check karma; aim for 100+.
- **Week 4:** start drafting the first showcase post offline and get the screenshots ready. Keep commenting. By now the account should have roughly 40 to 60 comments and 1 or 2 posts, none of them promotional. That makes one promotional post about 2% of activity.
- **After the first post:** keep up at least the same comment pace. Each further promotional post needs about 9 non-promotional contributions in between.

## 5. Top 4 moves, in order

1. **Weeks 1 to 4: warm up the account (above). In week 1, also check reddit.com/domain/goodwatch.app.** Nothing else in this channel family works before this. Cost: about 15 minutes a day.
2. **Week 5: an r/mcp Showcase post, then an r/ClaudeAI "Built with Claude" post one week later.** These are the two most on-target subs that explicitly allow promotion, and the MCP server is the most distinctive feature.
   - r/mcp: a hand-written post with the Showcase tag that says it is the owner's own and fully launched. Cover what the tools do, the batch writes and undo design, the poster cards in MCP Apps, and lessons learned. Link /use-with-ai and the GitHub repo.
   - r/ClaudeAI: a different angle that meets the rule's checklist: how Claude Code built a solo product, what worked and what failed, and "free to try". Needs more than 100 karma.
   - Post on a weekday morning US time (the timing advice is not verified).
3. **Week 6 or 7, on a Saturday: r/webdev Showoff Saturday.** Pick one deep technical story, for example moving the scripts after first paint to take mobile Lighthouse from 83 to 96, the dynamic OG image pipeline, or the 103 Early Hints. Use the Showoff Saturday flair, frame it as "project, not product", and put the link at the end. Developer readers are the most likely to write blog posts that give followed links.
4. **Weeks 7 to 10: one r/dataisbeautiful [OC] post built from GoodWatch's own data.** Examples: how far IMDb, RT and Metacritic scores disagree, or episode consistency across long-running shows from the IMDb datasets. Name the data sources and tools in the first comment (rule 3), and link the GoodWatch page that shows the full interactive version there, not in the title. Avoid Mondays (personal data day) and Thursdays (US politics day). This is the move most likely to earn followed links from blogs and press, as the FlowingData and Genbeta pickups show. Check the IMDb datasets licence wording for this use first (owner decided non-commercial use is OK; not re-verified here).

Optional after these: one post in an r/Letterboxd weekly thread about Letterboxd import, one Trakt forum topic in 3rd Party > Other, and one r/opensource post with the Promotional flair for the MIT-licensed repo. Space them a week or more apart.

## Sources

- Reddit Rules: https://redditinc.com/policies/content-policy
- Spam: https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam
- Keep spam out (10% rule, filters): https://support.reddithelp.com/hc/en-us/articles/28012014962580
- Reddiquette: https://support.reddithelp.com/hc/en-us/articles/205926439-Reddiquette
- Disrupting communities: https://support.reddithelp.com/hc/en-us/articles/360043066412
- Manipulated content and AI: https://support.reddithelp.com/hc/en-us/articles/41180423371156
- Flagged for spam: https://support.reddithelp.com/hc/en-us/articles/360045309012
- Banned for spam: https://support.reddithelp.com/hc/en-us/articles/360045734911
- Doing that too much: https://support.reddithelp.com/hc/en-us/articles/204579879
- Karma: https://support.reddithelp.com/hc/en-us/articles/204511829
- Contributor Quality Score: https://support.reddithelp.com/hc/en-us/articles/19023371170196
- Reputation filter: https://support.reddithelp.com/hc/en-us/articles/27441485903124
- Crowd Control: https://support.reddithelp.com/hc/en-us/articles/15484545006996
- Ban evasion filter: https://support.reddithelp.com/hc/en-us/articles/15484544471444
- Reddit Pro content and sign-up: https://support.reddithelp.com/hc/en-us/articles/47619289307412 and https://support.reddithelp.com/hc/en-us/articles/24368958859668
- Old self-promotion wiki (Wayback capture 2026-09-28): https://www.reddit.com/r/reddit.com/wiki/selfpromotion
- Reddit nofollow check (Wayback capture 2025-12-31): https://www.reddit.com/r/InternetIsBeautiful/
- Google on nofollow hints: https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify
- Subreddit rule archive: https://arctic-shift.photon-reddit.com (rules, wikis, posts APIs)
- 2026 cross-checks: https://rankhog.com/subreddits/ and https://willitstay.com/r/
- Reddit and Google deal: https://engadget.com/reddit-is-licensing-its-content-to-google-to-help-train-its-ai-models-200013007.html
- Letterboxd terms and community policy: https://letterboxd.com/legal/terms-of-use/ and https://letterboxd.com/legal/community-policy/
- Trakt forums categories: https://forums.trakt.tv/categories.json
- IMDb community guidelines: https://help.imdb.com/article/imdb/new-features-updates/imdb-community-guidelines/G4G5SA8CHKB9QACM
- Discord guidelines: https://discord.com/guidelines
- Lemmy.world terms and selfhosted rules: https://legal.lemmy.world/tos/ and https://lemmy.world/post/48725669

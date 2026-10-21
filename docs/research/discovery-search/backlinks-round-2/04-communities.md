# Communities and recurring threads (round 2)

Scope: this report covers places where you can mention GoodWatch inside an existing community instead of on a directory page. It includes subreddits that round 1 skipped or covered only briefly, with their recurring promotion threads; Discord servers; forums and Fediverse groups; recurring Hacker News threads other than Show HN; launch boards with a community and a launch day that round 1 didn't grade; and newsletters with a submission route. Research date: 2026-10-21. Research only: nothing was posted, joined, submitted, voted on, or sent. Round 1's [02-reddit-forums.md](../backlinks/02-reddit-forums.md), [01-launch-platforms.md](../backlinks/01-launch-platforms.md), and [07-dev-platforms.md](../backlinks/07-dev-platforms.md) are not repeated here.

## Summary

- **Four places in this channel give a followed link for free, with no badge and no payment:** Tildes link topics (checked on a live ~tv topic), MCPnewsletter's web archive, What's on Netflix articles, and Caschys Blog editorial links. Tildes needs an invite. The last two are editors' choices, so they depend on a good pitch. (PeerPush was first counted here. The lead's check of its pricing page shows the free tier needs a badge, so it moved to the skip list.)
- **Everything else here gives `nofollow`, `ugc`, or no crawlable link at all.** Every Reddit thread is `nofollow ugc`. Hacker News comment links are `nofollow` (819 of the 835 comment links checked). The Plex, Trakt, and OpenAI forums are `nofollow ugc` (Discourse). Discord messages sit behind a login. Judge these by visitors and by who might write about GoodWatch later.
- **The best-fit communities are the ones tied to imports GoodWatch already has:** the Plex forum's Apps & Creations category (2,511 active users a week, and the forum's rules say "We want you to be able to tell the Plex community about it"), the Trakt forum's 3rd Party category, and the r/Letterboxd Discord (22,110 members).
- **The monthly "Ask HN: What are you working on?" thread is the cheapest way to build Hacker News history before a Show HN.** It gets about 1,000 to 1,500 comments and runs on the second Sunday of most months. It needs no karma. Only about 1 top-level comment in 5 gets a reply, so expect few visitors. No October 2026 edition had appeared by 2026-10-21.
- **Reddit's recurring promotion threads are small.** r/startups allows promotion only in a quarterly "Share your startup" thread (191 comments on 2026-10-11; next one expected around 2027-01-11). r/javascript's weekly "Showoff Saturday" gets 7 to 22 comments. r/horror's weekly "Self Promo Sunday" gets 14 to 65 and needs 100 karma. r/reactjs allows promotion only as "Portfolio Sunday" posts. r/de, r/germany, r/television, and r/criterion bar self-promotion outside narrow cases. The German-language r/Filme (116,903 members) is the exception: it allows your own original content in moderation, which fits a German write-up of the study.
- **Almost every new launch board trades a followed link for a badge on your site or a fee.** That is a link exchange or a paid link under Google's spam policy. None of the 21 live boards gives a free followed link without a badge. PeerPush looked like the exception, but its pricing page says the free plan has "badge required on your site, do follow backlink only if you hit the top 5 daily ranking" (read 2026-10-21).
- **The German angle works best through tip forms, not communities.** Caschys Blog (2.77 million visitors in August 2026, by its own media kit) has a public tip form and followed editorial links. t3n takes topic ideas by email. r/de bans self-promotion, and the German streaming forums checked either don't render external links or use `nofollow`.

## 1. Subreddits: recurring threads and rules

How this was checked: reddit.com blocks this network, so the rule text comes from the Arctic Shift archive of Reddit's own rules API (captured January or February 2025), and member counts come from the `subreddit_subscribers` field on recent archived posts (dated 2026-09 to 2026-10-21). Recurring threads were found by searching archived post titles. Where a third-party capture from October 2026 (willitstay.com) agreed with the rule text, the row says "x-check 2026-10". Reddit links are `rel="noopener nofollow ugc"` (round 1, verified). Comment links in threads were not checked separately (not verified, expected to be the same).

Every row: link type `nofollow ugc`, cost free. "2025-01" means rule text archived January 2025. Hours are estimates for one hand-written post or comment, after the account warm-up described in round 1.

### Maker and startup subs

| Sub | Members | Recurring thread, cadence, recent instance | Self-promotion rule (quote) | Karma or age rule | AI rule | Fit | Hours |
|---|---|---|---|---|---|---|---|
| r/startups | 2.1M (willitstay, 2026-10-21) | "Share your startup - quarterly post", on the 11th of January, April, July, and October. Latest 2026-10-11, 191 comments: https://www.reddit.com/r/startups/comments/1x3dcp4/share_your_startup_quarterly_post/ . Next expected around 2027-01-11 | "No direct sales, advertisements, or promotional posts of any kind ... You MAY share your startup in the Monthly Share Your Startup thread" (the rule says monthly; the archive shows quarterly since at least 2025-07). Feedback requests go in the weekly feedback thread. (2025-01, x-check 2026-10) | None published (x-check 2026-10) | None published | Low: founders, not viewers | 0.25 |
| r/SideProject | 875,943 | None. The whole sub is for sharing; title format "[Project name] - [Short description]" | "publishes no formal rule list" (willitstay, rules checked 2026-10-08) | None published | None published | Medium: busy, maker audience | 1 |
| r/indiehackers | 197,586 | No thread. Members prefix posts "Show IH"; all 8 newest (2026-10-07 to 2026-10-20) had 0 comments | "Users can self promote their product 1 time using the SHOW IH flare. The purpose is for feedback and critique not advertisement." (2025-01, x-check 2026-10 in round 1) | None published | None published | Low | 0.5 |
| r/EntrepreneurRideAlong | 730,474 | None found | "Self-Promotion ONLY with Value ... Share your work only if it genuinely benefits the community. No blatant promotion." Also "No Links to Newsletters". (2025-01) | None published | None published | Low: works only as a numbers post without a link | 1 |
| r/alphaandbetausers | 50,106 | None | "Posts must include links to products that are ready to be tested"; tag stage and system; "please take the time to test someone else's product as well." (sidebar, date not archived) | None published | None published | Low | 0.5 |
| r/IMadeThis | 52,228 | None | No policy; sidebar: "Go on Reddit, brag a little." | None published | None published | Low | 0.25 |
| r/roastmystartup | 36,202 | None | "You can only submit your own start-up. We will look through your post history" and "YOU MUST POST A CLICKABLE LINK IF YOUR BUSINESS IS ALREADY OUT THERE." (sidebar) | None published | None published | Low: harsh feedback only | 0.5 |

### Developer and AI subs

| Sub | Members | Recurring thread, cadence, recent instance | Self-promotion rule (quote) | Karma or age rule | AI rule | Fit | Hours |
|---|---|---|---|---|---|---|---|
| r/javascript | 2,454,330 | "Showoff Saturday (Month DD, YYYY)", weekly, posted by AutoModerator. Latest 2026-10-17, 7 comments: https://www.reddit.com/r/javascript/comments/1x83kd2/showoff_saturday_october_17_2026/ . Recent editions had 7 to 22 comments | "It's ok to promote your own content ... but it should not constitute a majority of your contributions." "Advertising paid products and services is prohibited." Demos "don't provide for much discussion unless code is provided as well." (2025-01, x-check 2026-10) | None published | None published | Low to medium: small threads; link the repo next to the site | 0.5 |
| r/reactjs | 515,616 | "Portfolio Sunday": members post with a "[Portfolio Sunday]" prefix on Sundays. Examples: 2026-08-23 (5 comments) https://www.reddit.com/r/reactjs/comments/1vvtuvo/portfolio_sunday_repodna_a_react_flow/ , 2026-06-07 (7 comments) | "Promotion is only allowed in Portfolio Sunday" (willitstay, 2026-10-21). 2025 rule: "If you join this community to take value rather than contribute, the community will quickly react as though you are an intruder." | None published | A "Guidelines: AI" rule exists; its text isn't in the archive (not verified) | Low to medium | 1 |
| r/node | 352,487 | None found. Members self-flag "[Showcase]" posts; recent ones had 0 or 1 comments | No rules archived (not verified) | Not known | Not known | Low | 0.5 |
| r/ChatGPT | 11,570,563 | "weekly self-promotional mega thread, which is pinned" (rule 3). Instances were not found in the archive (not verified) | Posts "may not be solely focused on advertising a single other LLM service (all these posts should directly go to weekly self-promotional mega thread, which is pinned)" (2025-01, x-check 2026-10-20) | None published | AI art only if "unique, unusual, or particularly interesting" | Medium: GoodWatch runs as a ChatGPT app; megathread posts get little attention (round 1, not verified) | 0.25 |
| r/OpenAI | 2,889,111 | None found | "The 1/10th rule is a good guideline ... Self-promotional direct link posts to projects are not allowed. If you are promoting your own project, context must be provided in a text post" (2025-01) | None published | None published | Medium: a text post about building a ChatGPT app with the Apps SDK | 1.5 |
| r/artificial | 1,354,286 | None found | "Your first post or comment cannot have promo ... it's 10% ... modmail us first before posting." "No selling your own products" (2025-01) | None published | None published | Low | n/a |

### Film and TV subs

| Sub | Members | Recurring thread, cadence, recent instance | Self-promotion rule (quote) | Karma or age rule | AI rule | Fit | Hours |
|---|---|---|---|---|---|---|---|
| r/horror | 3,552,831 | "Weekly Thread: Self Promo Sunday", every Sunday, by AutoModerator. Latest 2026-10-18, 32 comments: https://www.reddit.com/r/horror/comments/1x96rs1/weekly_thread_self_promo_sunday/ . Recent editions had 14 to 65 comments | "Self Promotion (regardless of commercial intent) is not allowed ... Please keep self promotion posts in the weekly thread that comes out every Sunday." Also: "Check JustWatch.com before asking where to stream something." (2025-01) | **Posts removed if the account is under one day old, comment karma is under -75, or total karma is under 100** (2025-01) | None published | Medium, if you link a horror page such as a horror genre or best-of page. A 2026-03-14 "I built a free site for tracking horror movies" post got 1 comment | 0.25 |
| r/Letterboxd | 570,788 | Member-run "What's your four recents this week?" (2026-09-26, 147 comments; 2026-10-05, 49 comments). Mod weekly threads for original content are named in the rules; titles not found in the archive (not verified) | "Original content (LB lists/reviews, third-party OC etc.) is generally only permitted within our weekly threads", with exceptions for high-effort OC "pending mod discretion". "Self-promotion and low-effort/low-quality posts will be removed." (2025-01) | None published | None published | Medium: core audience for the Letterboxd import. A 2026-07-18 "I built a weekly curated newsletter" post got 0 comments | 0.5 |
| r/television | 18,137,100 | Weekly Rec Thread (52 in 2025, per a 2026-01-16 member post: https://www.reddit.com/r/television/comments/1qerbiz/ ). Recommendation requests only go there | "All requests for recommendations belong in our weekly recommendation thread." "People looking for help to find where to watch something should use justwatch.com or an alternative." (2025-01) | None published | None published | Low. Precedent: a 2026-09-18 "I built a free site to help people discover shows from these weekly recommendation threads" post got 15 comments and a score of 4 | 1 |
| r/PleX | 416,345 | "Tool Tuesday" stopped in 2017 (last 2017-04-18). No current tools thread found | "everyone is allowed to promote their own sites and products however we require you to have already contributed (i.e. submit other links, take part in discussions to the subreddit in the past). We also require you not to do it too often" (2025-01) | None published | None published | Medium: Plex import | 1 |
| r/trakt | 13,987 | None | No rules archived | Not known | Not known | Low to medium: Trakt import, small sub | 0.5 |
| r/flicks | 256,191 | None | "Self-promotion should be limited ... Is the primary purpose of this post/comment about engaging the community (good), or is it just to promote their content (bad)?" Top-level comments need 100 characters. (2025-01) | None published | None published | Low | n/a |
| r/criterion | 335,455 | "Monthly marketplace for sales and trades", latest 2026-10-04 (buying and selling discs only) | "No buy/sell/trade posts outside of the monthly marketplace thread" (2025-01) | None published | None published | None | Skip |
| r/anime | 14,480,349 | "Casual Discussion Fridays", weekly (2026-10-16, 889 comments): a chat thread, not for promotion | "Everything posted here must be anime-specific"; bots and novelty accounts banned (2025-01) | None published | None published | Low | Skip |
| r/TVDetails | 175,856 | None | Posts must be obscure, intentional show details (2025-02) | None published | None published | None | Skip |
| r/NetflixBestOf | 11,591,646 | None | No rule list; sidebar asks posters to link "the description page of the movie or show" and add a regional flair (sidebar, date not archived) | None published | None published | Low | Skip |
| r/jellyfin | 135,531 | None | Restricted since 2023: "We're now read-only indefinitely ... See https://jellyfin.org/posts/new-forum" (sidebar, 2025-01) | n/a | "incoherent posting, including ChatGPT output" removed | None | Skip |
| r/BingeWatching, r/StreamingRecommendations | n/a | n/a | Not active or not in the archive (r/BingeWatching's newest archived post is 2025-05-30) | n/a | n/a | None | Skip |

### German subs

| Sub | Members | Recurring thread | Self-promotion rule (quote) | Karma or age rule | AI rule | Fit | Hours |
|---|---|---|---|---|---|---|---|
| r/Filme | 116,903 | None found | "Bitte unterlasst Werbung. In gesundem Maße erlaubt ist Original Content (OC), bspw. Reviews, Essays oder generell Videos mit Filmbezug. Im Titel sollte ersichtlich sein, ob man selbst der Urheber des Inhalts ist." Content "muss das Subreddit ergänzen". German only. (2025-02) | None published | None published | Medium: a German write-up of the study's German findings, marked as your own OC | 1.5 |
| r/de | 3,213,834 | None | "Eigenwerbung für ein bestimmtes Produkt, eine Dienstleistung, eine Webseite, einen YouTube-Kanal o.ä. ist verboten. Seltene Ausnahmen können nach Absprache mit dem Mod-Team erteilt werden." (2025-01) | None published | "mittels KI erstellte Inhalte werden entfernt" | Low: only with mod approval first | n/a |
| r/germany | 1,179,198 | Megathread for short questions | "We generally don't allow self-promotion and surveys. If you want an exception, ask us in a modmail about this before posting" (2025-01). English only | None published | "Do not post content written by ChatGPT or other automated writing tools." | Low | n/a |

## 2. Discord servers

Public information only: member and online counts from Discord's invite API (`/api/v10/invites/<code>?with_counts=true`) or the public server directory (Discovery). No server was joined, so channel lists and rules inside servers were not read. Link value is none for search on every row, because messages sit behind a login (reasoned, not verified). Cost is free on every row. Hours are estimates.

| Server | Invite (where found) | Members / online | Showcase or self-promo (public text) | Fit | Risk | Hours |
|---|---|---|---|---|---|---|
| Culture Crave | discord.gg/culturecrave (Discovery) | 28,051 / 1,616 | Discovery page: "dedicated channels for users to show off whatever project they're working on" | Good: movie, TV, and game fans | Low | 0.5 |
| r/Letterboxd Discord | discord.gg/letterboxd (sub sidebar) | 22,110 / 2,498 | Discovery page: "share your profile, lists, and reviews with other Letterboxd members". No promotion rule visible | Good: GoodWatch imports Letterboxd exports | Medium: a fan server may not welcome a tool post (not verified) | 0.5 |
| Model Context Protocol community server (run by Glama) | discord.gg/TFE8FmjCdS (glama.ai/mcp/discord redirects here) | 14,425 / 1,897 | Discovery page: "Showcase your MCP projects", plus an "mcp-server-author" role | Good: remote MCP server | Low | 0.5 |
| Movies & Filmmaking | discord.gg/movies (Discovery) | 98,161 / 6,015 | None documented. Rules visible only after joining | Medium | Medium | 0.5 to 1 |
| The TV Lounge, Filmtopia, Film Cord, The Film Collective | Discovery; discord.gg/films, discord.gg/filmcord | 12,134 / 367; 11,263 / 840; 5,698 / 221; 4,385 / 268 | None documented. Film Cord has a "Creative Corner" for fan work | Medium to low | Medium | 0.5 each |
| r/ClaudeCode Discord (founded 2026-07-25) | Discovery | 4,074 / 740 | "Share your projects, workflows, prompts, and discoveries" | Medium: build story | Low | 0.5 |
| Claude (official) | discord.gg/anthropic (anthropic.com/discord) | 132,388 / 22,074 | Showcase channel not publicly documented (not verified) | Medium | Unknown | 0.5 |
| OpenAI (official) | discord.gg/openai | 857,429 / 63,797 | Not documented (not verified) | Low to medium | Unknown | 0.5 |
| Glama, Smithery, mcp.so servers | Invites on each site | 2,789 / 236; 1,598 / 137; 1,185 / 47 | Not documented | Medium: MCP | Low | 0.25 each |
| r/Plex Discord (community run) | discord.gg/plex (r/PleX sidebar) | 17,088 / 3,311 | Not documented | Medium: Plex import | Unknown | 0.5 |
| MCP Contributors (official) | discord.gg/6CSzBmMkjX (modelcontextprotocol.io) | 4,972 / 526 | Its rules bar "Service or product marketing - Keep discussions vendor-neutral" | None | High | Skip |
| Jellyfin (official), Emby (unofficial) | jellyfin.org/contact; a 2018 Reddit post | 17,193 / 4,077; 2,090 / 259 | Not documented | Low: no Jellyfin or Emby import | Medium | Skip |
| Media-server support servers: Servarr, Sonarr, Seerr, LinuxServer, Tautulli, Kometa, MDBList | Each project's site or README | 41,310; 22,281; 14,977; 41,047; 9,024; 8,264; 3,732 members | Support servers | None today. Seerr and MDBList fit if the readers in #712 and #711 ship | Medium | Skip for now |
| Similar products' servers: Simkl, Serializd, Ryot | Each site | 9,815; 3,915; 457 members | Their own product servers | None | High | Skip |
| Indie maker spaces | indieworldwide.co redirects to Ramen Club (paid). WIP uses Telegram. No Discord linked from Indie Hackers or Peerlist | n/a | n/a | n/a | n/a | Skip |

No official Kodi, Trakt, or Plex Inc. Discord was found (not verified).

## 3. Forums and the Fediverse

Discourse, which runs the Plex, Trakt, and OpenAI forums, ships with `add_rel_nofollow_to_user_content: true`. Its default `tl3_links_no_follow: false` drops nofollow only for trust level 3 users, which takes months of steady activity (Discourse source, `config/site_settings.yml`). New users get 2 links per post by default (Discourse default, not verified per forum).

| Forum | Where to post / rules | Size (source) | Activity | Self-promotion rule (quote) | Link type (page checked) | Referral value (estimate) | Risk | Fit | Hours |
|---|---|---|---|---|---|---|---|---|---|
| Plex forum, Dev Community > Apps & Creations | forums.plex.tv/guidelines; trademark rules at /t/76652 | 1,117,093 users; 2,511 active in 7 days, 6,757 in 30 days (about.json). 7,890 topics in the category | New third-party topics on 2026-10-20; topics get about 30 to 2,000 views | "We want you to be able to tell the Plex community about it. However, blatant advertising, promotion, or posting multiple times is not permitted." Also: "Try not use AI or chatbots to automate formulating topics or replies." | `noopener nofollow ugc` (/t/943205, a Plex and Trakt sync tool) | Low to medium | Low | Good: Plex import, and similar trackers post there | 1.5 |
| Trakt forum, 3rd Party > Other or Mobile Apps | forums.trakt.tv/faq | 68,900 users; 597 active in 7 days, 2,107 in 30 days (about.json). Other: 37 topics | Newest topic in Other 2026-09-05 | Bans "Spamming or self-promotion unrelated to Trakt" and cross-posting "the same content in multiple categories" | `noopener nofollow ugc` (/t/104614, /t/116985) | Low | Medium: a disclosed AI-built Trakt client got "Vibe-coding... Thanks but no" in /t/104614 | Good: Trakt import | 1 |
| OpenAI Developer Forum, ChatGPT Apps SDK category (558 topics) | community.openai.com/faq | 1,041,927 users; 15,104 active in 30 days (about.json) | Topics on 2026-10-19 and 2026-10-21 | "Share the cool things you have built, but avoid repetitive or overly promotional posts." | `noopener nofollow ugc` (/t/1406893) | Low | Low | Medium: GoodWatch is in the ChatGPT app directory | 1 |
| Jellyfin forum (MyBB) | forum.jellyfin.org/rules | 25,605 members, 14,251 topics (index page) | Posts within hours | Don't "post off-topic anywhere except the designated off-topic forums" and don't "Post verbatim replies from "AI" Chat systems" | **Followed**: `rel="noopener"` only, no robots meta (two third-party app threads) | Low | High until GoodWatch talks to Jellyfin | Poor today | Skip unless a Jellyfin import ships |
| Emby community, Third Party Apps | emby.media/community/forum/96-third-party-apps/ | 1,880,389 members (index) | Newest topic 2026-10-20; a rival watch tracker posted 2026-07-31 | No self-promotion rule found | `external nofollow` (topic 148897) | Low | Medium | Poor: no Emby import | Skip |
| Kodi forum | kodi.wiki/view/Official:Forum_rules (archived 2026-10-15) | Unknown: forum showed "Unavailable due to urgent maintenance" | n/a | "Do not try to sell services or hardware to individuals on our forums." | (not verified) | Very low | Medium | Poor: no Kodi add-on | Skip |
| Tildes ~tv and ~movies | docs.tildes.net/policies/code-of-conduct | 24,777 and 25,048 subscribers (group pages) | ~tv topics on 2026-10-20 | "If you have your own site/project/channel/etc. that you'd like to share on Tildes, that's generally fine (in moderation), but it shouldn't be the primary reason that you post on the site." Registration "is currently invite-only." | **Followed**: the link-topic anchor has no `rel` and the page has no robots meta (checked /~tv/1wj4, a side-project link topic, twice) | Low to medium | Medium: needs an invite and real participation | Good: data study, title pages | 0.5, then about 1 a week (estimate) |
| AVS Forum | Rules not readable: bots are redirected to tollbit.avsforum.com | Unknown | Unknown | (not verified) | (not verified) | Unknown | Medium (not verified) | Medium | Read the rules in a browser first |
| Cord Cutters News code of conduct | cordcuttersnews.com/cord-cutters-news-code-conduct/ | n/a | n/a | "#5 No Spam: Promoting a service you own or anything we may see as a spam may be removed for any reason." | n/a | n/a | High | n/a | Skip (the tip form in section 6 is the route) |
| teltarif.de forum, Streaming | teltarif.de/forum/faq.html | Topic numbers near 100 | Newest topic 2026-08-01 | FAQ: only teltarif.de URLs become "vollwertige Links" (real links) | None: external URLs stay plain text | None | Low | Low | Skip |
| hifi-forum.de, TV and streaming | Terms not read | Unknown | Streaming threads dated 2015 to 2023 | (not verified) | `nofollow` (viewthread-86-1429-17) | Very low | Low | Low | Skip |
| ComputerBase, Digitalfernsehen | Rules not found; bot wall | 435,962 members (ComputerBase index) | Active | (not verified) | (not verified) | Low | Medium | Low | Skip |
| Letterboxd, JustWatch, Moviepilot, Serienjunkies | Letterboxd has no forum. No JustWatch community found. Moviepilot and Serienjunkies community features not checked | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Skip |

### Fediverse

| Community | Size (how obtained) | Rules (quote) | Link type | Fit | Hours |
|---|---|---|---|---|---|
| lemmy.ml/c/opensource | 49,627 subscribers, 4,163 active a month (`/api/v3/community`) | "Posts must be relevant to the open source ideology" | `noopener nofollow` (lemmy-ui source) | Good for the MIT repo | 1 |
| piefed.social/c/movies | 4,002 subscribers, 2,955 active a month (`/api/alpha/community`) | "Do not spam", "Stay on topic" | `nofollow ugc` (checked on a piefed.world listing) | Medium: data study | 0.5 |
| piefed.social/c/television | 3,329 subscribers, 2,577 active a month | "Avoid spamming or promoting unrelated products/services." | `nofollow ugc` | Medium: episode grid | 0.5 |
| programming.dev/c/opensource | 6,890 subscribers, 1,960 active a month | Description only | `nofollow` | Medium | 0.5 |
| lemmy.ml/c/movies, lemmy.ca/c/plex, lemmy.ml/c/jellyfin | 5,529 / 24 active; 3,144 / 25; 9,287 / 157 | n/a | `nofollow` | Low | Skip |
| Film-only Mastodon servers | None among the 294 servers in api.joinmastodon.org. zirk.us (arts) has 536 active a month | n/a | Mastodon posts are nofollow (round 1) | Low | Skip |
| fosstodon.org | 7,378 active a month | "DO NOT post commercial promotions" and "Fosstodon is invite only" | `nofollow` | Low | Skip |
| neodb.social | 36,993 active a month (instance API; may be inflated, not verified) | Not read | n/a | A federated catalogue and tracker, a similar product | Skip |
| Dead: lemmy.world/c/television, lemmy.ml/c/plex, infosec.pub/c/cordcutters, feddit.org/c/Filme_und_Serien | 1 active a month, or 43 subscribers (API) | n/a | n/a | None | Skip |

## 4. Recurring Hacker News threads

Found with the HN Algolia API (`/api/v1/search_by_date`, tag `ask_hn`) and the official Firebase API. Show HN is in round 1.

| Thread | Cadence (evidence) | Size | Link type (checked) | Account needs | Fit | Hours |
|---|---|---|---|---|---|---|
| **Ask HN: What are you working on? (Month Year)** | Monthly, posted on the second Sunday by the same long-standing member: 2026-04-12, 05-10, 06-14, 07-12, 08-09, 09-13. No October 2026 edition by 2026-10-21. Latest: https://news.ycombinator.com/item?id=49686380 | 290 to 464 points and 1,100 to 1,470 comments each since October 2025. September 2026: 729 top-level comments; median 0 replies, 19.6% got at least one reply | `nofollow` on 819 of 835 comment links in the September 2026 thread (live HTML). 16 had no `rel`; HN doesn't publish when it drops nofollow on comments (not verified) | None published. New accounts show a green name (FAQ). Whether a new account's comment with a link gets auto-killed is not documented (not verified) | Good: a short, honest "what I built and why" comment fits the thread's purpose, and it builds the comment history the 2026 Show HN restriction asks for | 0.25 a month |
| Look-alike "What are you working on?" posts by other members | Irregular: 2026-10-19 (9 points, 18 comments), 2026-10-01 (10 points, 30 comments), 2026-08-02 (22 points, 56 comments) | Small | `nofollow` (expected, not checked) | None | Low | Skip |
| "Ask HN: What are you building that's not AI related?" and "(non-AI)" variants | One-offs: 2026-04-09 (156 points, 227 comments), 2026-05-13 (49 points, 61 comments) | Medium | `nofollow` (expected) | None | Medium if one appears: GoodWatch's scores, availability, and episode grid aren't AI | 0.25 when one appears |
| Ask HN: Share your personal website | Irregular, roughly yearly: 2022-04-06 (665 points), 2023-01-06 (103), 2026-01-14 (950 points, 2,386 comments) | Large | `nofollow` (expected) | None | Low: it's for personal sites, not products | Skip |
| Ask HN: Show your micro-SaaS | One-off: 2026-09-06 (30 points, 44 comments) | Small | `nofollow` (expected) | None | Low: GoodWatch isn't a SaaS | Skip |
| Who is hiring / Who wants to be hired | Monthly on the 1st | Large | n/a | None | None: job threads | Skip |

How to find each new edition: query `https://hn.algolia.com/api/v1/search_by_date?query=%22What%20are%20you%20working%20on%22&tags=ask_hn&numericFilters=points%3E50`, or watch the second Sunday of the month on /ask.

## 5. Launch boards with a community and a launch day

These are boards with daily or weekly launches and votes. Static directories are covered by another agent in round 2, and round 1 graded Product Hunt, Uneed, Peerlist, Microlaunch, Indie Hackers, DevHunt, Fazier, BetaList, and others. Every listing named below was fetched as live HTML on 2026-10-21. Tranco ranks come from the Tranco list file dated 2026-10-20. "Badge" means the free tier asks you to put their badge, linking back, on goodwatch.app. Hours are estimates.

| Platform | Alive (newest launch) | Cost and free path | Link type (listing checked) | Traffic signs | Spam risk | Fit | Hours | Submit URL |
|---|---|---|---|---|---|---|---|---|
| **PeerPush** (peerpush.net redirects to peerpush.com) | Yes; daily "Product of the Day". A movie-app listing published 2026-04-29 | Free plan: "badge required on your site, do follow backlink only if you hit the top 5 daily ranking". Featured 9 EUR, Boost 29 EUR, and All-In 49 EUR each give a "permanent do follow backlink" with no badge (peerpush.com/pricing, read 2026-10-21) | **Followed** (`rel="noopener"`) on /p/reelrank, /p/cinema-circle-yfzw, /p/starflicks, which are likely paid or top-5 listings. Links carry `?utm_source=peerpush&ref=peerpush` | Tranco 449,682. Claims 1.35 million monthly visits (self-reported). The movie-app listing has 66 upvotes | Medium: points for upvoting and visiting other products work like a vote exchange; upsell for submissions to 100 directories | Has a "Letterboxd alternatives" page with 10 movie and TV apps, but the free plan needs a badge. Skip | 0 | peerpush.com/pricing |
| TinyLaunch | Yes; top launches this period have 34, 30, and 22 upvotes | Free with badge; top 3 get a backlink. $39 premium | `nofollow noopener` on /launch/22359-udonboost. Dofollow is "granted when you embed the badge" | Not in Tranco. Claims "30,000+ users" | High: badge for dofollow, $279 directory-submission upsell | Low: makers | 0.5 plus launch day | tinylaunch.com/pricing |
| PitchWall (BetaPage now redirects here) | Yes; listing published 2026-10-21 | Free: 30-day wait, 1 day on the home page. $49 or $99 | `nofollow`, through a `/out/` 302 redirect that robots.txt disallows, although the pricing page promises a "Do-follow backlink (DR 70)" (/product/subtitle-generator, /hadrius, /backplane) | Tranco 194,875. Claims 500k monthly visitors and a 50k newsletter | Medium | Low | 0.5 | pitchwall.co/submit |
| StartupBase | Yes; today's top has 12 votes | Free with badge, 4 to 5 week queue. "Outrank" sells a "permanent dofollow link" from $15 | Mixed on the home page; followed on /products/kwill-2 (tier not verified) | Tranco 698,587. Claims 60k monthly visitors | High: sells links | Low | n/a | startupbase.io/launch |
| LaunchIgniter | Yes; week 42 winners posted 2026-10-19 | Free with badge; only the top 3 get dofollow. $12 to $99 | Followed on /product/dayboard, a winner. Free listings are nofollow per the pricing page | Tranco 899,636 | High: sells links on sister sites | Low | n/a | launchigniter.com/pricing |
| OpenHunts | Yes; week of 2026-10-19: 27, 25, 23 votes | Free: 20 slots a week, queue about 60 weeks, or add their badge. $19 for dofollow | Followed on /projects/dayboard (tier not verified) | Not in Tranco. About 18.6k visits a month (its own PostHog numbers) | High | Low | n/a | openhunts.com/pricing |
| ScrollLaunch, LaunchBoard, Smol Launch, Noonlaunch, ufind.best | Yes, weekly; top votes 29, 9, unknown, 3, unknown | Free only with a badge, or only the weekly winner gets dofollow. $11 to $39 | ScrollLaunch, Smol Launch, Noonlaunch: followed on one listing each (tier not verified). LaunchBoard: JavaScript only (not verified). ufind.best: free listings are nofollow per its own submit.md | None in Tranco | High: badge or pay | Low | n/a | /pricing on each |
| Open-Launch and its clones (Firsto, ProductFame network) | Yes; top votes 0 to 3 | Free queues full into 2027 or about 180 days; $6.90 to $59.90 | `nofollow` (/projects/assetsanalyzer-5245, /projects/graphics-arts-solution, /products/spek) | None in Tranco | High: cross-linked networks; ProductFame sells guest posts with "2 dofollow links" | Low | n/a | /pricing on each |
| SideProjectors (marketplace) | Yes; listing dated 2026-10-20 | Free showcase | `nofollow ugc noopener` on /project/102237 | Tranco 145,672 | Low | Low: people buying and selling projects | 0.5 | sideprojectors.com |
| Startup Fame, Turbo0, SaaSFame, Twelve.tools | Yes | Free requires a badge or a link back; SaaSFame: "657 tools are already waiting", reviewed "within 180 days" | Paid listing on Startup Fame followed; free not verified | Tranco 193,244; 284,483; not listed; 239,981 | High: reciprocal-link model | Low | n/a | /pricing on each |

Dead or not a launch board: Hunted.space is a Product Hunt analytics site whose product pages link to Product Hunt; launch.so is a domain for sale; shipit.so is parked; indiedeals.co returns HTTP 500; ProductBurst shows a "limit exceeded" page; news.bensbites.com redirects (301) to the Substack newsletter; Launchpedia is a guides site; Launch Llama is a newsletter; Super Launch and LaunchClash have 0 to 1 votes and a 2025 footer.

## 6. Newsletters and tip lines with a submission route

"Followed" means the archived issue or article HTML had no `nofollow`, `ugc`, or `sponsored` on the links checked. Audience numbers are each outlet's own claim. Round 1 covered Cord Cutters News tips, TLDR, Console.dev, Hacker Newsletter, Ben's Bites, PulseMCP, Tiny Startups, the Indie Hackers newsletter, Cooperpress (JavaScript Weekly, Node Weekly), and Changelog News; rows below add what was new.

| Newsletter or outlet | Audience (source) | Submission route | Free or paid | Archive link type (issue checked) | Fit | Hours |
|---|---|---|---|---|---|---|
| **MCPnewsletter** | Not published | mcpnewsletter.com/submit: "Submit MCP servers, launches, repos, tutorials, news..." | Free form | **Followed**: direct links, no `rel` (issue #006, "MCP Con Amsterdam") | High: MCP server | 0.25 |
| **What's on Netflix** (site and newsletter) | 180K+ newsletter subscribers (its about page) | whats-on-netflix.com/about/, "Tips / Corrections / Contact" form | Free | No newsletter archive found. Article links **followed**, `rel="noopener"` ("Netflix library by the numbers 2025") | High for the 139-country study: the site tracks only 4 countries itself | 0.5 |
| **Caschys Blog** (German) | 2,771,334 visitors and 6.87 million page views in August 2026 (its media kit) | stadt-bremerhaven.de/tipp-senden/ | Free form | Editorial links **followed**, `noopener noreferrer` (a 2026 Cursor article). Affiliate links are `sponsored nofollow` | Medium to high: has a Streaming category; German angle on the study, or a German solo developer's launch | 0.5 |
| The Rundown AI, Supertools directory | 2,000,000+ newsletter readers (its site) | rundown.ai/submit: the free route is an email to the support address on that page. A newsletter feature is advertising | Directory free; newsletter paid | Directory listing **followed**, `noopener noreferrer` (/tools/weavely). The newsletter archive on rundown.ai/articles is `nofollow` | Medium: AI movie picker inside ChatGPT and Claude. Acceptance of a consumer site not verified | 0.25 |
| React Status, Frontend Focus, Node Weekly (Cooperpress) | React Status "nearly 40,000"; JavaScript Weekly "over 170,000" (cooperpress.com/publications, may be dated) | cooperpress.com/submit/ | Free | React Status: **followed**, no `rel` (issue #493). Frontend Focus not verified | Medium, only for engineering articles | 0.25 each |
| t3n (German) | Not published | the editorial email address listed for "Themenvorschläge, Artikelideen" on t3n.de/kontakt/ | Free | Article links **followed**, no `rel` (two articles). Some tool articles may be behind t3n Pro (not verified) | Medium: German version of the study, MCP angle | 1 (shared with the Caschys text) |
| Gründerszene (German) | Not published | the editorial email address for "Neuigkeiten und neue Startups" on businessinsider.de/gruenderszene/kontakt/ | Free | Followed, `noreferrer noopener`; many articles paywalled | Low: covers funded startups | 0.5 |
| deutsche-startups.de, Startup-Radar | Not published | the editorial email address on deutsche-startups.de/kontakt/kontakt/ | Free | Startup-Radar issues #344 to #347 are paid-only on Substack, so Google can't see their links | Low | 0.5 |
| Glama MCP newsletter | 60,000+ developers (glama.ai/newsletter) | Contributed article by email (address on glama.ai/newsletter): "Mentioning your product is fine..." | Free | No archive found. Glama blog links are `ugc nofollow` (2026-07-25 post) | Medium audience, no link value | 4 to 6 |
| Cord Cutters News | Not published | cordcuttersnews.com/contact-us/ (general form) | Free | Editorial links not verified; affiliate links have no `rel` | Medium with a study finding | 0.5 |
| Sidebar.io | Not published | sidebar.io/submit (account needed) | Free | Every link goes through a `sidebar.io/out?url=` redirect (home page) | Low: design links only | 0.5 |
| TLDR, TLDR AI, TLDR Dev | 8M+ in total; AI 1.1M, Dev 470K (tldr.tech) | None found; ads only (advertise.tldr.tech) | Paid only | Editorial links followed, sponsor links nofollow (AI and Dev issues of 2026-10-20) | Only through a story that does well elsewhere | n/a |
| Superhuman AI, Ben's Bites, This Week in React, Remix newsletter, PulseMCP | 1.5M+; 172,000; 40,297; not published; not published (own pages) | None found (sponsorship only, or reply to the email) | n/a | Followed on Superhuman, Ben's Bites, This Week in React (#301), Remix (#41); PulseMCP not verified (Cloudflare) | Low | n/a |

## Recommended moves

Ranked by value per owner hour. Hours are estimates. "Followed" means checked in live HTML as described above.

| Rank | Move | Hours | Link type | Why it ranks here |
|---|---|---|---|---|
| 1 | **Submit the MCP server to MCPnewsletter** (mcpnewsletter.com/submit). Describe the remote OAuth server and the poster cards in MCP Apps. | 0.25 | Followed in the web archive | A free form made for exactly this, with a followed archive link. The audience size is unknown, but the cost is 15 minutes. |
| 2 | **Comment in the next monthly "Ask HN: What are you working on?"** with 3 or 4 hand-written sentences and one link to a title page or /use-with-ai. Repeat each month only with something new. | 0.25 a month | `nofollow` | Builds the HN comment history that the 2026 Show HN restriction asks for, reaches about 1,000 builders, and costs almost nothing. Expect a handful of visits. |
| 3 | **Send the 139-country study to What's on Netflix and Caschys Blog** once it's out of draft, one finding first, written by hand (English for What's on Netflix, German for Caschys; reuse the German text for t3n's editorial address). | 1.5 for all three | Followed article links on all three | These are the only large consumer outlets in this channel with a public tip route and followed links. What's on Netflix covers 4 countries; the study covers 139. Coverage is an editor's choice, so treat it as a bet. |
| 4 | **Post once in the Plex forum's Apps & Creations category** about the Plex import ("Works with Plex", no "Plex" in the product name). | 1.5 | `nofollow ugc` | The forum rules invite third-party apps, about 2,500 people are active a week, and the readers are exactly the people who use the import. |
| 5 | **Skip PeerPush** (corrected by the lead). The free plan requires a badge on goodwatch.app, and only paid plans get an unconditional followed link. | 0 | n/a | Moved here so the ranking numbers stay stable. A badge is a link exchange and a paid followed link is a paid link under Google's policy. |
| 6 | **Post once in the Trakt forum's 3rd Party > Other category** about the Trakt export import. Lead with what it does, not with how it was built. | 1 | `nofollow ugc` | Small but exact audience. An AI-built Trakt client drew pushback there in 2026, so keep the post about the user's data and the result. |
| 7 | **Ask for a Tildes invite, take part for a few weeks, then post the study as a link topic in ~movies or ~tv.** | 0.5, then about 1 a week | Followed (link topic checked) | The only community link in this research that is followed and fits. Its code of conduct allows your own projects in moderation if they aren't the main reason you post. |
| 8 | **Showcase the MCP server in the Model Context Protocol community Discord** (run by Glama), and mention the Letterboxd import in the r/Letterboxd Discord if its rules allow it after joining. | 1 | None (behind login) | Free referral clicks and feedback from exact audiences. No search value. |

Optional after these, each 0.25 to 1.5 hours:

- The Rundown Supertools email listing (followed directory link).
- A Cooperpress submission per engineering article (React Status for the scripts-after-paint piece).
- A German "OC" post of the study's German findings in r/Filme, with "eigener Inhalt" (own content) in the title.
- One comment in r/javascript's "Showoff Saturday" that links the repo and the engineering write-up.
- One lemmy.ml/c/opensource post about the MIT repo, and one piefed.social/c/movies post about the study.
- r/horror's "Self Promo Sunday" thread, if a horror page exists to link (needs 100 karma).
- The r/startups quarterly "Share your startup" thread around 2027-01-11.

## Skip list

| Item | Reason |
|---|---|
| Launch boards that trade dofollow for a badge or a fee (TinyLaunch, OpenHunts, LaunchIgniter, StartupBase, ScrollLaunch, LaunchBoard, Smol Launch, Noonlaunch, ufind.best, Open-Launch, Firsto, ProductFame, Startup Fame, Turbo0, SaaSFame, Twelve.tools) | Google's link spam policy names "Excessive link exchanges" and buying links. Free tiers are nofollow, queues run to 60 weeks or 2027, and the audience is makers. |
| PitchWall (ex-BetaPage) | Promises dofollow, but the live link is a nofollow redirect blocked by robots.txt. |
| Dead boards (Hunted.space, launch.so, shipit.so, indiedeals.co, ProductBurst, Ben's Bites news board, Super Launch, LaunchClash) | Not launch boards any more, or no activity. |
| r/de, r/germany | r/de: "Eigenwerbung für ein bestimmtes Produkt, eine Dienstleistung, eine Webseite ... ist verboten" and AI-made content is removed. r/germany: self-promotion only with prior mod approval, and "Do not post content written by ChatGPT". |
| r/television, r/TVDetails, r/criterion, r/anime, r/NetflixBestOf, r/flicks | No promotion route: r/television sends where-to-watch questions to JustWatch; r/TVDetails is for show details; r/criterion's monthly thread is a marketplace; r/anime requires anime-specific posts. |
| r/jellyfin | Restricted (approved posters only) since the 2023 protest; the community moved to forum.jellyfin.org. |
| r/BingeWatching, r/StreamingRecommendations | Not active or not found in the archive. |
| r/node, r/artificial, r/EntrepreneurRideAlong, r/IMadeThis, r/alphaandbetausers, r/roastmystartup | No thread, tiny engagement on showcase posts (0 or 1 comments on r/node), "first post or comment cannot have promo" (r/artificial), or a founder audience with no interest in a movie site. |
| MCP Contributors Discord | Its rules bar product marketing. |
| Kodi, Emby, Jellyfin forums | GoodWatch has no integration with them, so a post would be off-topic. Revisit if a Jellyfin or Emby import ships (the Jellyfin forum's links are followed). |
| Cord Cutters News community, AVS Forum, teltarif, hifi-forum, ComputerBase, Digitalfernsehen | Self-promotion banned, rules unreadable behind bot walls, or links not rendered or `nofollow`. |
| Similar products' servers (Simkl, Serializd, Ryot, NeoDB) | They're competitors' own communities. |
| HN "Share your personal website", "Show your micro-SaaS", hiring threads | Wrong purpose for a product. |
| TLDR, Superhuman AI, The Rundown newsletter feature, There's An AI For That, Futurepedia | Paid only. |
| Ben's Bites, This Week in React, Remix newsletter, PulseMCP newsletter | No submission route found. |
| selfh.st Self-Host Weekly, Web Tools Weekly, Console.dev, Cool Tools | Wrong category (self-hosted apps, front-end tools, developer tools) or a rule that the reviewer has used the tool for six months. |
| JustWatch, Moviepilot, Wunschliste newsletters | Competitors with their own streaming guides. |
| Indie Worldwide (now Ramen Club), WIP | Paid communities. |

## Owner decisions this channel raises

1. **Tildes:** do you want to ask a member for an invite? It's the only followed community link that fits GoodWatch today (the Jellyfin forum's links are followed too, but off-topic without a Jellyfin import), and it needs a few weeks of real participation first.
2. **German pitches:** do you want to pitch the study in German to Caschys Blog and t3n? That means writing a German summary by hand.
3. **Integrations as a door to communities:** a Jellyfin or Emby history import would make the Jellyfin forum (followed links, 25,605 members) and Emby's Third Party Apps category legitimate places to post. Shipping the Seerr and MDBList readers (#712, #711) opens their Discords.
4. **Launch badges:** confirm that you don't want any launch-board badges on goodwatch.app. Every board checked, including PeerPush, ties its free followed link to one.

## Sources

All accessed 2026-10-21 unless noted.

Reddit:
- Arctic Shift API (rules, sidebars, posts): https://arctic-shift.photon-reddit.com/api/subreddits/rules, /api/subreddits/search, /api/posts/search
- willitstay.com captures: https://willitstay.com/r/SideProject (rules checked 2026-10-08), https://willitstay.com/r/startups, https://willitstay.com/r/javascript, https://willitstay.com/r/reactjs (checked 2026-10-21), https://willitstay.com/r/ChatGPT (checked 2026-10-20)
- Reddit link `rel` check: round 1, Wayback capture of https://www.reddit.com/r/InternetIsBeautiful/ dated 2025-12-31

Hacker News:
- HN Algolia API: https://hn.algolia.com/api/v1/search_by_date and https://hn.algolia.com/api/v1/items/49686380
- HN Firebase API: https://hacker-news.firebaseio.com/v0/item/49686380.json
- Live HTML of https://news.ycombinator.com/item?id=49686380 (September 2026 thread)
- HN FAQ: https://news.ycombinator.com/newsfaq.html

Discord:
- Invite API: https://discord.com/api/v10/invites/<code>?with_counts=true for each invite listed
- Discovery: https://discord.com/servers?query=movies (also film, tv shows, letterboxd, mcp, startup, claude)
- https://modelcontextprotocol.io/community/communication, https://glama.ai/mcp/discord, https://www.anthropic.com/discord, https://jellyfin.org/contact

Forums and Fediverse:
- Plex: https://forums.plex.tv/guidelines, https://forums.plex.tv/about.json, https://forums.plex.tv/c/dev-community/apps-creations/53.json, https://forums.plex.tv/t/76652.json, https://forums.plex.tv/t/943205
- Trakt: https://forums.trakt.tv/faq, https://forums.trakt.tv/about.json, https://forums.trakt.tv/t/104614, https://forums.trakt.tv/t/116985
- OpenAI: https://community.openai.com/faq, https://community.openai.com/about.json, https://community.openai.com/t/1406893
- Jellyfin: https://forum.jellyfin.org/rules, https://forum.jellyfin.org/robots.txt
- Emby: https://emby.media/community/forum/96-third-party-apps/
- Kodi rules (archived 2026-10-15): https://kodi.wiki/view/Official:Forum_rules
- Tildes: https://tildes.net/~tv/1wj4/spelunkr_cable_tv_but_weirder, https://docs.tildes.net/policies/code-of-conduct
- Cord Cutters News: https://cordcuttersnews.com/cord-cutters-news-code-conduct/
- German forums: https://www.teltarif.de/forum/faq.html, https://www.hifi-forum.de/viewthread-86-1429-17.html, https://www.computerbase.de/forum/
- Fediverse: https://api.joinmastodon.org/servers, https://fosstodon.org/api/v1/instance/rules, https://lemmy.ml/api/v3/community?name=opensource, https://piefed.social/api/alpha/community?name=movies
- Discourse defaults: discourse/discourse `config/site_settings.yml` on GitHub (Discourse organization)

Launch boards:
- https://peerpush.com/pricing, https://peerpush.com/p/reelrank, https://peerpush.com/alternatives/letterboxd
- https://tinylaunch.com/pricing, https://pitchwall.co/submit, https://startupbase.io/launch, https://launchigniter.com/pricing, https://openhunts.com/pricing, https://open-launch.com/pricing, https://firsto.co/pricing, https://productfame.com/pricing, https://scrolllaunch.com/pricing, https://launchboard.dev/pricing, https://smollaunch.com/pricing, https://noonlaunch.com/pricing, https://ufind.best/submit.md, https://startupfa.me/pricing, https://sideprojectors.com/project/102237
- Tranco list (file dated 2026-10-20): https://tranco-list.eu

Newsletters:
- https://mcpnewsletter.com/submit and https://mcpnewsletter.com/issues/mcpnewsletter-006-mcp-con-amsterdam
- https://www.whats-on-netflix.com/about/
- https://stadt-bremerhaven.de/tipp-senden/ and https://stadt-bremerhaven.de/die-zahlen-unseres-blogs-mediakit/
- https://www.rundown.ai/submit and https://www.rundown.ai/tools/weavely
- https://cooperpress.com/submit/, https://cooperpress.com/publications/, https://react.statuscode.com/issues/493
- https://t3n.de/kontakt/, https://www.businessinsider.de/gruenderszene/kontakt/, https://www.deutsche-startups.de/kontakt/kontakt/
- https://glama.ai/newsletter, https://cordcuttersnews.com/contact-us/, https://sidebar.io/submit
- https://tldr.tech/ai/2026-10-20, https://tldr.tech/dev/2026-10-20, https://thisweekinreact.com/newsletter/301, https://remix.run/newsletter/41

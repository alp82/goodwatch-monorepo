# How GoodWatch can earn links from other sites, round 2

Researched 2026-10-21 for issue #667, as a follow-up to [round 1](backlinks-research.md) (2026-10-18). Round 2 goes wider than round 1 and skips everything round 1 graded or the owner already did: the Official MCP Registry, AlternativeTo, SaaSHub, Launching Next, Tiny Startups, and the Claude and ChatGPT app directories.

Research only: nothing was posted, submitted, signed up for, followed, or sent. Seven research passes ran in parallel, one per channel family. Each pass read the platform's own rules, pricing, and submission pages, and checked link types in live HTML where it could. The lead agent then re-checked the claims the ranking depends on and fixed one conflict between the reports (PeerPush, see [What the lead re-checked](#what-the-lead-re-checked)). The full reports, with every source URL and access date, are in [`backlinks-round-2/`](backlinks-round-2/):

| Report | Channel family | Graded |
| --- | --- | --- |
| [`01a-directory-megalists.md`](backlinks-round-2/01a-directory-megalists.md) and [`01a-directories-graded.csv`](backlinks-round-2/01a-directories-graded.csv) | 28 "submit to 100+ directories" lists, merged and deduped | 1,963 domains merged, 144 graded |
| [`01b-niche-directories.md`](backlinks-round-2/01b-niche-directories.md) and [`01b-niche-directories-graded.csv`](backlinks-round-2/01b-niche-directories-graded.csv) | AI tool directories, web app galleries, movie resource pages, library guides, German and EU directories | 122 graded |
| [`02-open-source-data.md`](backlinks-round-2/02-open-source-data.md) | Awesome lists, open-source directories, GitHub page, vendor showcases, dataset portals | 80 graded |
| [`03-creators.md`](backlinks-round-2/03-creators.md) | Micro creators and newsletters: how to find them, what to offer, outreach rules, email law | 50 candidates (private list) |
| [`04-communities.md`](backlinks-round-2/04-communities.md) | Subreddit recurring threads, Discord, forums, Fediverse, recurring HN threads, launch boards, newsletters with forms | About 110 graded |
| [`05-content-pr.md`](backlinks-round-2/05-content-pr.md) | Streaming journalists, "best apps" listicles, podcasts, unlinked mentions, broken links, Wikipedia, German and EU media | 40 outlets, 33 listicles, 24 podcasts, 36 dead tools; 28 press candidates (private list) |
| [`06-google-guardrails.md`](backlinks-round-2/06-google-guardrails.md) | Google and Bing link rules applied to each round 2 tactic, plus a 60-second red flags checklist | 25 tactics |

Labels used in this file: "followed" means the link had no `nofollow`, `ugc`, or `sponsored` value in the live HTML that was checked, not that every listing on that site is followed. "(not verified)" means no primary source confirmed the claim. Traffic numbers are the sites' own reports or estimates.

## Private files

Names, handles, and profile links of individual creators and journalists are kept outside the repo and are never committed:

- `~/goodwatch-private/backlinks-creators/candidates.md`: 50 creator and newsletter candidates (42 English, 8 German) with profile link, audience size and date, why GoodWatch fits, the published contact route, and a fit score from 1 to 5.
- `~/goodwatch-private/backlinks-creators/press-candidates.md`: 28 streaming journalists at 25 outlets with beat, a recent article, the outlet's tip route, and the study number that fits each one.

## Summary

- **Free, unconditional followed links are rare, and round 2 found about a dozen.** The checked ones are SideProjects, OGimage.gallery, MCPnewsletter's archive, European Alternatives, Go European, Zenodo, Tildes link topics, the LibHunt page GoodWatch already has, and editorial links at What's on Netflix, Caschys Blog, The Verge, Cord Cutters News, t3n, and BGR. Almost everything else is nofollow, `ugc`, a nofollow redirect, behind a login, paid, or tied to a badge.
- **The directory mega-lists are mostly written by the directories they list.** Of 28 source lists, at least 17 are run by launch boards or paid "submit to 100 directories" services. Their "dofollow" labels are often wrong. Of 266 directories graded across both directory reports, about 45 pass the filter, and only about 15 are worth an owner's time.
- **A free followed link on a launch board almost always costs a badge on goodwatch.app.** 20 boards gate it that way, PeerPush included. Google names "excessive link exchanges" and paid links as link spam, so round 2 recommends a blanket rule: no badges and no paid "dofollow" tiers.
- **Most of the best moves wait on the data study leaving draft.** The press pitches, the German pitches, the Zenodo deposit, Google Dataset Search, the library-guide notes, the blog directories, and most creator pitches all need a public study URL. Today the study page is `noindex, nofollow` and the blog feed has no items.
- **The news gives a time-limited hook.** JustWatch launched its own streaming service, JustWatch TV, on 2026-10-20 in 12 markets, including Germany. The writers who covered it are the best-fit press list for an independent "where is it streaming" guide. Price rises at Disney+ (US, 2026-10-21) and Netflix Germany (2026-09-03) fit the study's "what do you get for the money" numbers.
- **The study's title-level CSV is labeled CC BY 4.0, and TMDB's terms don't allow that.** TMDB's license is "non-sublicensable", and the file holds TMDB titles, IDs, and years for 5,400 titles. Release only the country-level counts, with TMDB, JustWatch, and IMDb credits. Google's link rules have no problem with the license line. The problem is TMDB's terms.
- **Creator outreach works if it offers data and asks for nothing.** Custom country numbers, a season grid image, or early access are things of value. If any of them is conditional on a link, Google requires `rel="sponsored"`. German law (§ 7 (2) Nr. 2 UWG) bans cold advertising email to businesses too, so German creators can be reached only through channels they invite.
- **Wikipedia stays out.** The study is a self-published source, and adding it yourself is self-citation. Round 1's verdict stands.

## Top 15 moves, ranked by value per owner hour

The ranking weighs the link type, the audience fit, the odds of success, and owner hours. "Waits on" names what has to happen first. Every move uses the brand name "GoodWatch" or the bare URL as the link text, links the home page or an indexable page (never a list or profile page), and goes through the [red flags checklist](backlinks-round-2/06-google-guardrails.md#red-flags-checklist).

| Rank | Move | Owner hours | Link type | Waits on | Why it ranks here | Report |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Submit the MCP server to MCPnewsletter** (mcpnewsletter.com/submit) | 0.25 | Followed in the web archive (issue #006 checked) | Nothing | A free form made for MCP launches, read by the exact audience of the MCP server | 04 |
| 2 | **Launch on SideProjects, free** (sideprojects.net/projects/submit) | 0.3 | Followed (`rel="noopener"`, re-checked by the lead) | Nothing | The only launch board of 144 graded that gives a free followed link with no badge, vote, or payment. Free queue "usually within a few weeks" | 01a |
| 3 | **Submit a title card to OGimage.gallery** | 0.1 | Followed (no `rel`) | Nothing | Five minutes. GoodWatch's 1200x630 title cards fit the gallery. Small, design-minded audience | 02 |
| 4 | **Set the AlternativeTo listing's license to Open Source (MIT)** and add the repo link | 0.2 | Same as the existing listing | Nothing | Puts GoodWatch in short open-source lists: 14 apps for JustWatch and 20 for Letterboxd, instead of crowded views | 02 |
| 5 | **Claim the Glama connector page, and ask the awesome-jev-projects list to add the homepage link** | 0.5 | Both pages link GitHub today, followed | Owner OK for the DNS record and sign-in | Two existing mentions turn into goodwatch.app links. Whether claiming lets you add a website link is (not verified) | 05 |
| 6 | **Pitch the three writers who covered the JustWatch TV launch**: The Verge, Cord Cutters News, What's on Netflix. One finding each | 1.5 | Followed editorial links at all three (checked) | The study goes public | The highest-value links in round 2, and the hook is days old. What's on Netflix tracks 4 countries; the study covers 139. An editor's choice, so a bet | 05, 04 |
| 7 | **German pitches by hand: Caschys Blog tip form, t3n, inside digital.** Netflix Germany is 47th of 55 markets for the study's movies; Disney+ is the biggest service there | 1 | Followed (checked) | The study goes public | A German angle no US outlet will run, followed links, and you write German natively. Caschys Blog says it sells no links | 05, 04, 01b |
| 8 | **Fix the study's license line, then deposit the country-level CSV on Zenodo** and add the DOI to the page's Dataset markup | 1.5 | Followed (Zenodo, Tranco 3,671), plus a Google Dataset Search entry | The study goes public; owner OK for a permanent record | A citable DOI for writers and researchers. The page already serves `Dataset` JSON-LD, so Dataset Search only needs the page to be indexable | 02 |
| 9 | **Suggest GoodWatch to European Alternatives and Go European** as an alternative to IMDb, Rotten Tomatoes, and Letterboxd | 0.75 | Followed (European Alternatives re-checked by the lead) | Owner OK for the EU framing | Free, reviewed by people, followed. goodwatch.app runs on Hetzner in Germany. Neither has a movie category, so expect few visitors | 01b |
| 10 | **Comment in the monthly "Ask HN: What are you working on?"** thread with three or four sentences written by hand | 0.25 a month | Nofollow | The next thread (usually the second Sunday) | Builds the comment history the 2026 Show HN restriction asks for. No karma needed. About 1,000 to 1,500 comments a month, so expect a handful of visits | 04 |
| 11 | **Refresh the GitHub repo page**: description, topics (drop `dna`), social preview image, and a README top that names the MCP server and the study | 1.5 | Nofollow, but feeds the followed LibHunt page | Nothing | Every list reviewer and LibHunt visitor lands there. LibHunt already links goodwatch.app with a followed link and grows from mentions of the repo, so link the repo from every technical article | 02 |
| 12 | **Build the creator offer kit, then pitch about 6 data and map creators and streaming newsletters** from the private list, one custom country cut each | 2 to 3 for the kit, then about 3 | Followed from newsletter archives (Substack post links had no `rel`, one post checked); YouTube links are redirect-wrapped | The study goes public | The kit cuts each later pitch from about an hour to 15 minutes. A newsletter issue that cites the study is a durable followed link plus readers | 03 |
| 13 | **Broken-link emails, library guides first**: two University of North Carolina guides that still link the dead Can I Stream It, then pages that still link Graph TV (FlowingData, Laughing Squid, It's Nice That, The Mary Sue) and TV Time (Consumer Reports, How-To Geek, Make Tech Easier) | 2.5 for about 9 short emails | Followed on every page listed (checked) | The study goes public (for the library notes) | Pre-qualified pages that already link a dead tool of the same kind. GoodWatch's episode grid and TV Time import make it a fair replacement. Maintained library guides answer most often | 05 |
| 14 | **One sitting of cheap listings**: AppRater, HUNT0, Alternative.me, WebCatalog, and Made with React.js, with one shared description and three screenshots | 1.5 | Mostly nofollow or a redirect; Made with React.js is a 302 with no `rel` | Nothing | Visitors and a few more discovered links to the home page. AppRater has a human reviewer and a consumer audience; Alternative.me has a JustWatch alternatives page | 01a, 01b, 02 |
| 15 | **One post each in the Plex forum's Apps & Creations category and the Trakt forum's 3rd Party > Other category**, about the Plex and Trakt imports | 2.5 | `nofollow ugc` | Nothing | The forum rules invite third-party apps, and the readers are exactly the people the imports are for (about 2,500 active Plex forum users a week). Keep the Trakt post about the user's data, not about how it was built | 04 |

Moves 1 to 5 take about 1.5 hours together and need nothing first. Moves 6 to 8, 12, and 13 take about 12 hours and all wait on the study going public. That makes publishing the study the single step that unlocks the most value.

### Next after the top 15

Each is worth doing only after the top 15, in this order:

1. **Bluesky public replies** to film and TV creators with a data point that adds to their post, then one message if they engage (1 hour a week, no link value). Report 03.
2. **The episode grid sent to about 8 episode rankers and recap podcasts** a few days before a finale (about 2 hours, mostly no link). Report 03.
3. **Changelog News submission and a Filmspotting SVU listener email** (0.5 hours, followed). Report 05.
4. **BGR and Make Tech Easier**: pitch BGR for its next roundup and offer Make Tech Easier GoodWatch for the dead TV Time slot (0.75 hours, followed, low odds). Report 05.
5. **Awesome lists, written by hand**: public-apis "MCP Servers" (once a directory listing is live), awesome-useful-websites "Movies and Series", awesome-no-login-web-apps, TensorBlock's awesome-mcp-servers, and awesome-mcp-apps (about 2 hours, all nofollow). Several reject AI-written PRs. Report 02.
6. **Curlie's Arts > Movies > Databases** once the site responds (0.25 hours, followed, slow volunteer editors). Report 01b.
7. **Tildes**: ask for an invite, take part for a few weeks, then post the study in ~tv or ~movies (followed link topics). Report 04.
8. **ooh.directory and Feedle** for the blog, once the feed has two or more posts (0.2 hours). Report 01b.
9. **A German "eigener Inhalt" post of the study in r/Filme** (116,903 members), which allows your own content in moderation. Report 04.
10. **AI Engineering Podcast topic form** (1 hour, about 3 more if accepted, followed show notes). Report 05.
11. **Google Alerts and Talkwalker Alerts** for `"goodwatch.app"`, excluding the name collisions (0.25 hours). Pays off once press starts. Report 05.

## Round 2 rules

These add to round 1's [rules and pitfalls](backlinks-research.md#rules-and-pitfalls). The reports quote the source for each rule.

1. **No badges or link-backs on goodwatch.app**, even when that is the only free path. A badge for a listing is a link exchange. If a directory accepts a badge with `rel="nofollow"`, it's compliant, but none of those listings is worth it ([06](backlinks-round-2/06-google-guardrails.md)).
2. **Never buy a "dofollow", "DR 70+", or "permanent backlink" tier, or a "submit to 100 directories" package.** Google names "Exchanging money for links". A paid slot is fine only with `rel="sponsored"`.
3. **Ask for nothing about links.** Pitches, broken-link notes, and listicle suggestions are fine as requests with nothing offered in return. Send one personal message and at most one follow-up. Google's 2017 post warns against "aggressive or repeated" requests.
4. **Offer creators data and early access with no condition attached.** Make early access open to anyone who asks. If a creator asks how to link, the answer is that a `sponsored` or `nofollow` link is fine and they may say they got early access. Under FTC rules and § 5a (4) UWG, the creator discloses what they received.
5. **No cold email to German creators or German press.** Use tip forms and listener mail addresses they publish for suggestions, or start with a public reply. Most UK creators are sole traders, whom PECR treats like individuals, so the same caution applies. This is not legal advice.
6. **Release data at country level only.** No title-level lists of TMDB data, and no IMDb, Rotten Tomatoes, or Metacritic values in any file (round 1 rule 18). Credit TMDB with its notice, add "Streaming availability data from JustWatch, through TMDB", and add the IMDb courtesy line for the vote-count selection.
7. **Don't chase AI-generated "best of" pages** or offers to be included in them. They are likely scaled content abuse, and the offers are usually paid links.
8. **Space submissions out.** Google documents no "link velocity" rule, but Bing names bursts as a signal. Put weekly-board launches in different weeks.
9. **Keep a private submission log**: date, site, URL, cost, conditions, and the `rel` value seen. A reconsideration request asks for exactly this, and it makes the monthly Links report check fast.
10. **New in 2026:** Google's spam definition now covers "attempting to manipulate generative AI responses in Google Search" (updated 2026-08-28), and Bing's guidelines name "artificial social promotion schemes that simulate popularity". Never seed threads to look popular.

## Skip list

| Skip | Why | Report |
| --- | --- | --- |
| Directory mega-list ranks 13 to 29, and every "submit to 100 directories" service | About 15 minutes each for near-zero value on a consumer site | 01a |
| The 20 badge-gated boards, PeerPush included (for example StartupBase, LaunchIgniter, Startup Fame, Open Launch, ToolFame) | Badge for a followed link is a link exchange | 01a, 04 |
| Pay-for-dofollow AI directories (Toolify, Easy With AI, AI Agents List, OpenTools, FindMyAITool, AI Agents Listing, AItoolnet, euacc.ai) | Paid links | 01b |
| Reciprocal-link AI and German directories (Dang.ai, Toolpilot, German "Webkatalog" sites) | Link exchange | 01b |
| Auto-generated "sites like" pages | Automated, low quality. One report kept SiteLike as an optional 10-minute listing; the merged ranking drops it | 01a, 01b |
| data.world | Its open data community closed on 2026-07-13 | 02 |
| Hugging Face datasets, the title-level CSV anywhere | TMDB counts data sets of TMDB content for ML as commercial use | 02 |
| A Zenodo archive of the whole monorepo | Keeps every release forever, and the repo holds 163 CSV and JSONL files, including third-party data | 02 |
| Trakt, Letterboxd, Jellyfin, and Plex app lists | Trakt's apps page is gone, Letterboxd excludes recommendation and LLM projects, and the others need an integration GoodWatch doesn't have | 01b |
| r/de, r/germany, r/television, r/criterion | Bar self-promotion | 04 |
| Wikipedia | Self-published source and self-citation | 05 |
| Undercode News and other auto-generated articles | Not worth reclaiming | 05 |
| Instagram and Reddit creator discovery by script | Need a logged-in browser; do by hand if at all | 03 |

## What the lead re-checked

The lead agent re-fetched the pages behind the top of the ranking on 2026-10-21:

- **SideProjects:** the listing checked (`/projects/snapkin`) links the product with `rel="noopener"` only, so the link is followed.
- **PeerPush:** the pricing page says the free plan has "badge required on your site, do follow backlink only if you hit the top 5 daily ranking". Paid plans from 9 EUR give a "permanent do follow backlink". The communities report first ranked the free tier as a badge-free followed link. That claim is corrected in [`04-communities.md`](backlinks-round-2/04-communities.md), and PeerPush is on the skip list.
- **European Alternatives:** product links on a category page have no `rel`, so they are followed.
- **LibHunt:** `libhunt.com/r/goodwatch-monorepo` links `https://goodwatch.app/` with no `rel` and has no robots meta tag.
- **The study page:** it serves `noindex, nofollow`, a `Dataset` JSON-LD block, and the text "CC BY 4.0".

The lead also removed two personal names and one email address from the reports before committing, and reconciled two cross-report points: the guardrails report's "add Dataset markup" move now says the markup already exists, and its "license line is compliant" note now says that applies to Google's rules, not TMDB's terms.

## Decisions for the owner

1. **When does the study leave draft?** Moves 6 to 8, 12, and 13 wait on a public study URL. The JustWatch TV hook is fresh this week and fades over the next few weeks.
2. **The title-level CSV**: keep it with corrected license wording, cut it down to `tmdb_id` plus counts, or take it down? It is labeled CC BY 4.0 on the draft page today. Recommendation: release country-level counts only.
3. **A permanent Zenodo deposit** of the country counts. Records normally can't be withdrawn. Recommendation: yes, after the license fix.
4. **Blanket rules**: no badges on goodwatch.app, no paid dofollow tiers, and no paid slots unless marked `sponsored`. Recommendation: adopt all three.
5. **The EU framing** for European Alternatives and Go European. Does a sole trader in Germany meet the "EU-based company" rule? Only the web server's location was checked, so don't claim "EU hosted" for the whole service (PostHog, email, and AI providers weren't checked).
6. **Claim the Glama connector page?** It needs a DNS TXT record and a sign-in.
7. **Creator outreach budget**: about 10 hours for the first round (kit plus pitches)? Should early access be open to anyone (recommended) or to creators only?
8. **Lower-stakes calls:**
   - FMHY's Video page has a followed link and a fitting audience, but it is mainly a piracy index. Recommendation: skip, given the open TMDB question.
   - Should pitches avoid VPN "unlock Netflix" sites, which cite per-country data but sit next to circumvention content? Recommendation: avoid them.
   - Ask a Tildes member for an invite?
   - Pitch outlets with nofollow links (TechCrunch, T3, Moviepilot, netzwelt) for visitors only?
   - Anthropic's "Submit your build" spotlight asks for a "perpetual, and irrevocable license" and a statement that you hold the rights to everything shown, which includes TMDB images. Hold it until the TMDB position is settled?
   - Make GoodWatch installable? The web manifest's `start_url` and `scope` resolve to `static.goodwatch.app`, and there is no service worker. Fixing that opens PWA directories and the Microsoft Store, but brings few visitors.
   - The public repo holds third-party data files (TV Tropes repair results, production metadata backups). That is an exposure on its own, outside this research.

## Not verified, and it matters

- Whether a free listing gets the same link type as the listing checked, on most directories.
- Whether claiming the Glama page lets you add a website link.
- MCPnewsletter's audience size, and Kaggle's and Anthropic's spotlight link types.
- Subreddit rule text, mostly from early-2025 archive copies, because reddit.com blocked this network.
- Podcast audiences, which are estimates from chart rank and hosts' social counts.
- Whether the Claude and ChatGPT directory listings are public yet. On 2026-10-21, GoodWatch's claude.com marketplace page returned 404, so the passive mirrors (Claude Market, Node8) can't copy it yet.

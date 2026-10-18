# How GoodWatch can earn links from other sites

Researched 2026-10-18 for the decision ticket "Decide how GoodWatch earns links from other sites" (issue #667), part of the map in issue #347.

Research only: nothing was posted, submitted, signed up for, or sent. Seven research passes ran in parallel, one per channel family. Each pass read the platform's own rules pages, help centers, API docs, or source code, and checked link types in live or archived page HTML where it could. The full reports, with every source URL and access date, are in [`backlinks/`](backlinks/):

| Report | Channel family |
| --- | --- |
| [`01-launch-platforms.md`](backlinks/01-launch-platforms.md) | Hacker News, Product Hunt, AlternativeTo, SaaSHub, Uneed, Peerlist, and other launch sites |
| [`02-reddit-forums.md`](backlinks/02-reddit-forums.md) | Reddit sitewide rules, 30 subreddits, Letterboxd, Trakt, IMDb, Discord, Lemmy |
| [`03-social.md`](backlinks/03-social.md) | X, Bluesky, Mastodon, Threads, TikTok, Instagram, YouTube Shorts, Pinterest |
| [`04-listings-registries.md`](backlinks/04-listings-registries.md) | "Best of" articles, Wikipedia, awesome lists, MCP registries and directories, credit pages |
| [`05-linkable-assets-pr.md`](backlinks/05-linkable-assets-pr.md) | Data studies, widgets, free tools, journalist sourcing platforms, newsletters |
| [`06-google-policies.md`](backlinks/06-google-policies.md) | Google's link spam, nofollow, crawl budget, and robots meta documentation |
| [`07-dev-platforms.md`](backlinks/07-dev-platforms.md) | daily.dev, dev.to, Hashnode, Medium, Lobsters, and other technical publishing sites |

Labels used in this file: "(not verified)" means no primary source confirmed the claim. "Followed" means the link had no `nofollow`, `ugc`, or `sponsored` value in the HTML that was checked. Traffic numbers are founders' own reports or estimates, never measurements that transfer to GoodWatch.

## Summary

- **Almost every free, safe channel gives a `nofollow` or `ugc` link.** Reddit, X, Mastodon, GitHub, Wikipedia, Product Hunt, Glama, SaaSHub, and Indie Hackers all qualify their links. Google treats these as hints: it "may" use them to discover URLs, but they "will generally not be followed" and don't count for ranking ([06](backlinks/06-google-policies.md#2-qualifying-outbound-links-and-whether-nofollow-links-still-help)). Their value is visitors, and the bloggers and writers among those visitors who later link with followed links.
- **Followed links come from a short list of places.**
  - Writers and bloggers who choose to cite GoodWatch.
  - Technical articles on dev.to and freeCodeCamp News, and the web archives of JavaScript Weekly and Node Weekly.
  - PulseMCP (via the Official MCP Registry) and the public listing pages of the Claude and ChatGPT directories.
  - A Hacker News post that reaches about 10 points.
  - AlternativeTo for established listings, and some MCP directories.

  Writers cite data, so a data study is the only repeatable way to earn editorial links from the movie and streaming press. Developers cite engineering write-ups, and GoodWatch already has the measurements for several.
- **Two things on GoodWatch's side limit every channel.**
  - Shared list and profile pages are `noindex, nofollow`, so a link to a list passes nothing on to the title pages it shows. Their preview images are portrait or square, so Bluesky, Mastodon, and X crop them or shrink them to a thumbnail.
  - TMDB's API terms count use "in connection with a 'destination' website, search engine, or interactive query-response system (including large language model (LLM) ... or chatbots)", and use "to drive traffic", as commercial use that needs a written agreement. This is already an open owner question in the repo. Promotion makes GoodWatch more visible, and the MCP directories put the chatbot use in front of reviewers.
- **The MCP server is GoodWatch's most distinctive story.** The Official MCP Registry manifest and the Claude directory submission kit already exist in the repo. Few movie MCP servers exist, and one direct competitor is already listed in the main remote-server list.
- **Communities need a warm-up first.** Hacker News restricts Show HN for unfamiliar accounts as of 2026. On Reddit, moderator filters hide new accounts' posts without telling them, and the best-fit subs require more than 100 karma or disclosure. Budget about a month of genuine participation before the first promotional post.
- **Skip:** paid directories (BetaList, There's An AI For That, Futurepedia), paid "dofollow" tiers (mcpservers.org, mcp.so, Uneed, Microlaunch, Fazier), reciprocal badges, Wikipedia, and keyword-anchored widgets. Google names each of these as link spam or ignores them.

## Before you start: three prerequisites

These come before week 1 because they change what each later move is worth.

1. **Decide the TMDB position.** The [TMDB API terms](https://www.themoviedb.org/api-terms-of-use) (last updated 2023-10-20) list, as commercial uses:
   - Use "on or in connection with a 'destination' website, search engine, or interactive query-response system (including large language model (LLM), artificial intelligence, or any other machine learning based interactive query-response systems or chatbots)".
   - Use to drive traffic or revenue.

   Section 1.C also excludes use "in connection with ... a machine learning (ML) or artificial intelligence (AI) based Application" from the free license. Commercial use "without such a written agreement constitutes a material breach". The question is already open in [`buzz-sources-research-2026-10-18.md`](../../implementation/talked-about-now/buzz-sources-research-2026-10-18.md) and [`tmdb-episode-catalog.md`](../season-episode-scores/tmdb-episode-catalog.md). The Claude directory asks whether data is first-party or proxied with permission. OpenAI's guidelines forbid integrating "with third-party APIs without proper authorization". This is not legal advice.
2. **Decide how shared lists behave for Google and in previews.** Google's [robots meta tag doc](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) says `nofollow` means "Do not follow the links on this page". List shares therefore don't help title pages get discovered. Even `noindex, follow` decays: John Mueller said in 2017 that a long-term `noindex, follow` page ends up "essentially kind of the same as a noindex, nofollow" (spokesperson, not documentation). The durable fix is to link shares and posts straight to indexable pages, or to make good lists indexable. Separately, Bluesky crops link cards to 1200:630, Mastodon shows a non-landscape card as a small square, and X's large card expects 2:1 ([03](backlinks/03-social.md#3-shareable-lists-og-cards-and-the-noindexnofollow-question)). The owner rejected wide list previews on 2026-09-26, and this report doesn't reopen that. When the owner posts a list, attach the card as an image and link a title page in the text. Title, person, and genre images are already 1200x630, so they fit as link cards everywhere.
3. **Check the accounts.** Can the owner's Hacker News account post a Show HN under the [2026 restriction](https://news.ycombinator.com/showlim)? Does the owner have a Reddit account with history? Is a paid Claude plan available for the Claude directory submission ("Free accounts can't submit")?

## Ranked shortlist: the 12 best moves

The ranking weighs link value, owner time, and risk, plus how many people the move puts in front of GoodWatch. Owner time is an estimate in hours.

| Rank | Move | Owner time | Link value | Risk | Why it ranks here |
| --- | --- | --- | --- | --- | --- |
| 1 | **Publish the MCP server to the Official MCP Registry** (`app.goodwatch/mcp`, manifest already in `goodwatch-webapp/server.json`) | 1 to 2 h | None directly (it's an API). It feeds PulseMCP, whose product links were followed in the HTML checked, plus Glama and other aggregators. | Very low | Ready to go, and other directories pull from it. PulseMCP has paused submissions and says it will pick servers up from the registry. |
| 2 | **List on AlternativeTo and SaaSHub**, and add Launching Next and Tiny Startups the same day | 1 to 2 h | AlternativeTo: followed for established listings, nofollow for small ones. SaaSHub: nofollow. | Low | AlternativeTo's free queue has no published length, so start it now. Its "Letterboxd alternatives", "JustWatch alternatives", and "Reelgood alternatives" pages send visitors looking for exactly this. |
| 3 | **Publish a data study: "Where critics and audiences disagree most, 2026"** on a stable GoodWatch URL, then pitch 3 to 5 writers one by one | 2 to 4 days | Followed links from the writers and blogs that cite it (the only repeatable source) | Medium: draws attention to the RT and Metacritic crawler | Writers compile this list by hand today (ScreenCrush, 2026-09-11). GoodWatch has four scores per title, which no single-site list has. The study page also links to the title pages that need discovery. |
| 4 | **Technical write-ups on dev.to**, starting with "Open Graph cards with Satori and resvg without stalling the Node server", then submitted to Node Weekly and shared in a daily.dev public Squad | 1 day an article, plus 30 min to share | dev.to body links: followed (live HTML). Node Weekly and JavaScript Weekly archives: followed. daily.dev: nofollow redirect, traffic only. | Low | This is the cheapest followed link found. Each article links to the goodwatch.app pages and repo files it discusses. The facts are already measured in `docs/benchmarks/`. See [07](backlinks/07-dev-platforms.md#article-ideas-tied-to-what-goodwatch-built) for five article ideas. |
| 5 | **Submit to the Claude Connectors Directory** with the kit in `docs/implementation/mcp-directory-listing.md` | Half a day | The website link on a claude.com marketplace page was followed (checked on Notion's page). Whether Community connectors get a public page is not verified. | Medium, until the TMDB position is settled | It is the only listing with real consumer browsing, and it reaches the people the MCP server is for. ChatGPT can follow once a `/terms` page exists. |
| 6 | **Bluesky maker account**: 3 to 5 posts a week into the film and TV feeds, plus the same posts on X by hand with varied wording | 2 to 3 h a week | Discovery only | Low | Bluesky's COO said "we don't de-promote your links" (TechCrunch, 2025-03-20). Live feeds exist: "📽️ Film" (9,794 likes), "📺 TV", and "Horror". X now says links in the post body are fine, but posting a link through its API costs $0.20. |
| 7 | **MCP developer listings**: a Glama connector, one PR to the awesome-remote-mcp-servers list, and a free mcpservers.org listing | 1 to 2 h | Nofollow | Low | These are where MCP builders and list makers look. The awesome list requires the Glama connector and that the PR author stars the repo. Skip every paid "dofollow" tier. |
| 8 | **Reddit, after a 4-week warm-up**: an r/mcp Showcase post, then an r/ClaudeAI "Built with Claude" post a week later, then r/webdev Showoff Saturday | 15 min a day for 4 weeks, then 2 h a post | `nofollow ugc` | Medium: silent filters and domain blocks | These subs explicitly allow disclosed self-promotion and match the MCP and engineering stories. r/ClaudeAI requires more than 100 karma. r/webdev wants "project, not product". |
| 9 | **One Show HN** from an established account, technical angle, posted 15:00 to 18:00 UTC | 4 to 8 h | Followed only at about 10+ points, which 8.4% of recent Show HNs reached | Medium | HN rewards a "how it was built" story. A front-page post can bring hundreds to thousands of visitors (anecdotal). Hacker Newsletter picks from HN too. |
| 10 | **One freeCodeCamp News tutorial**, for example the remote MCP server with OAuth | 2 to 3 days, plus the application | Followed (live HTML) on a high-authority domain | Low | The strongest single followed link in this research. It needs an application with 3 writing samples (the dev.to articles can serve), and the piece must be original to freeCodeCamp. One closing sentence about the project is allowed. |
| 11 | **An r/dataisbeautiful [OC] post** built from the data study | 3 h plus the study | `nofollow ugc`, but data posts get picked up by blogs | Medium | A viral r/dataisbeautiful IMDb heatmap led FlowingData and Genbeta to write their own pieces. The rules require naming the data sources and tools in the first comment. |
| 12 | **Turn the episode grid into a named tool page**, then run "When shows peak, and which final seasons let fans down" on top of it | 2 to 4 days | Followed links from coverage (Stat Significant's IMDb-only versions were picked up by GIGAZINE and Slashdot) | Medium: IMDb's non-commercial terms allow findings, not a dataset | The RT and Metacritic season scores are what competitors (Series Graph, Watch Peak) lack. |

Product Hunt (self-hunted at 12:01 am PT, a few weeks after Show HN, `ugc` link) comes after week 6. Use the HN feedback to polish first. Featuring is an editorial choice, so treat it as a traffic bet, not a link.

Moves left out on purpose: Wikipedia (conflict of interest, nofollow, spam blacklist risk), paid directories, paid "dofollow" tiers, Fazier's reciprocal badge, DevHunt (developer tools only), Uneed's free line (a launch-day score below 10 shuts the product out of the free line for good), TikTok, Instagram, and YouTube Shorts (no links in posts; revisit if the owner wants weekly video work), and journalist sourcing platforms until a study exists to point to.

## Six-week sequence

Each week assumes 4 to 8 owner hours. Every week also includes the 20-minute measurement check in [Measure with free tools](#measure-with-free-tools).

| Week | Moves | Done when |
| --- | --- | --- |
| 0 (before) | Settle the three prerequisites. Record the baseline: Search Console Links "Latest links" export, Page indexing counts by reason, Crawl stats Discovery versus Refresh, and Performance by page for 28 days. Add the site to Bing Webmaster Tools by importing it from Search Console. Export PostHog referrers. | Decisions recorded on #667, baseline saved next to `index-record.md` |
| 1 | Publish to the Official MCP Registry (1). Submit to AlternativeTo, SaaSHub, Launching Next, and Tiny Startups (2). Set up the Bluesky account and post twice (6). Start the Reddit, HN, and daily.dev warm-up: genuine comments, no links (8, 9). Write the SQL for the critics-versus-audiences study (3). | Registry search returns `app.goodwatch/mcp`; four submissions queued |
| 2 | Glama connector, awesome-remote-mcp-servers PR, free mcpservers.org listing (7). Claude directory submission, if the TMDB position allows it (5). Build the study page and charts (3). Write the Open Graph card article (4). Bluesky and X: 3 to 5 posts. | PR open; Claude submission sent; article drafted |
| 3 | Publish the OG card article on dev.to, submit it to Node Weekly, and share it in a daily.dev Squad (4). Publish the study, linking every title page it names (3). Post its headline finding on Bluesky and X. | Article and study live; study in the sitemap |
| 4 | Pitch the study to 3 to 5 writers who covered the topic in the last 12 months, one personal note each, no link request (3). Post the Show HN if the account qualifies (9). | Pitches sent; Show HN posted or rescheduled |
| 5 | r/mcp Showcase post (8). Publish a second dev.to article, for example the weekly indexing record, and submit it to Changelog News (4). Send the study's US finding to Cord Cutters News as a tip. | Post up and answered in the thread |
| 6 | r/ClaudeAI "Built with Claude" post, then r/webdev Showoff Saturday (8). Apply to freeCodeCamp News with the dev.to articles as samples (10). Review six weeks of measurement and decide what continues. | Review written on #667 |

After week 6: the freeCodeCamp tutorial once accepted (10), the r/dataisbeautiful post (11), the episode grid tool page and the season study (12), Product Hunt, a second study ("The best-rated streaming catalogue in every country", repeated each year), Lobsters after an invite and 70 days, and the ChatGPT directory once a `/terms` page exists.

## Channel table

Effort is owner hours. "Followed (observed)" means one or more listings had a followed link in the HTML checked, not that every listing does.

| Channel | Effort | Ban or downvote risk | Link type | Expected referral traffic | Prerequisites | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Official MCP Registry | 1 to 2 h | Very low | None (API); feeds others | Indirect | DNS TXT proof, `mcp-publisher` | Do (week 1) |
| PulseMCP | 0 after the registry | Very low | Followed (observed) | Low | Registry entry; submissions reopen | Do, automatic |
| Claude Connectors Directory | Half a day | Medium (TMDB terms) | Followed on the marketplace page checked | Highest of the MCP listings (estimate) | Paid Claude plan, screenshots, kit (ready) | Do (week 2) |
| ChatGPT plugin directory | 1 to 3 days | Medium to high (third-party API rule) | Followed on the page checked | High if approved (estimate) | `/terms` page, video, test cases, verification | Later |
| Glama connector | 30 min | Low | Nofollow | Low | None | Do (week 2) |
| awesome-remote-mcp-servers | 30 min | Low | Nofollow (GitHub) | Low, developers | Glama badge, starred repo | Do (week 2) |
| mcpservers.org (free) | 15 min | Low | Nofollow | Low | None | Do (week 2) |
| Smithery | 1 h | Low to medium (proxies member traffic) | Followed (observed, one page) | Low | Check its data terms first | Maybe |
| mcp.so | 30 min | Low | Followed (observed) for listed servers; free path unclear | Low | Skip the $39 "dofollow" tier | Maybe |
| Hacker News (Show HN) | 4 to 8 h | Medium | Followed at about 10+ points, else nofollow | A few dozen; hundreds to thousands on the front page (anecdotal) | Established account | Do (week 4) |
| Product Hunt | 8 to 15 h | Medium | `ugc` | Hundreds to thousands if featured (anecdotal, B2B tools) | Used personal account, gallery | After week 6 |
| AlternativeTo | 30 min to 1 h | Low | Followed for established, nofollow for small | Steady trickle (no numbers found) | Verified account | Do (week 1) |
| SaaSHub | 30 min | Low | Nofollow (free) | Small | Verify every 3 months | Do (week 1) |
| Launching Next, Tiny Startups | 15 min each | Very low | Not verified; nofollow observed on Tiny Startups | Very small | None | Do (week 1) |
| Uneed (free line) | 2 to 4 h | Low to medium | Followed only at score 20+ | Small | Wait 30 to 150 days | Skip unless 10+ votes are realistic |
| Peerlist, Microlaunch, Indie Hackers | 2 to 5 h each | Low to medium | Not verified, followed, nofollow | Small, makers | Verified profile (Peerlist) | Low priority |
| BetaList, TAAFT, Futurepedia, DevHunt, Fazier | n/a | Low | Paid, or followed only for money or a link back | Small | Money | Skip |
| r/mcp, r/ClaudeAI | 2 h a post | Medium | `nofollow ugc` | Low to medium, on target | Warm-up; 100+ karma (r/ClaudeAI) | Do (weeks 5 and 6) |
| r/webdev Showoff Saturday | 2 h | Medium | `nofollow ugc` | Low to medium | Saturday only, flair | Do (week 6) |
| r/dataisbeautiful | 3 h plus the study | Medium | `nofollow ugc` | High if it takes off | Real OC, sources in the first comment | After week 6 |
| r/MovieSuggestions, r/movies, r/cordcutters, r/netflix, r/ifyoulikeblank | 15 min a day | High for links (instant bans, domain blacklists) | None for own links | None | n/a | Warm-up only, never link |
| r/InternetIsBeautiful, r/selfhosted | n/a | High | `nofollow ugc` | n/a | Bans aggregators and AI content; self-hosted only | Skip |
| Letterboxd, IMDb | n/a | High | n/a | n/a | Letterboxd bans using it to run a competing business; IMDb bans links | Skip |
| Trakt forum (3rd Party > Other) | 30 min | Low | Not verified | Very small | Real Trakt import story | Optional |
| Bluesky | 1.5 to 2 h a week | Low | Discovery only | Tens of visits a week if posts land in feeds (estimate) | Disclose "I built this" | Do (week 1 on) |
| X | 1 h a week | Low to medium | Nofollow via t.co (not verified) | Low, uneven | Manual posting | Do, with Bluesky drafts |
| Mastodon | 1 h a week | Low | Nofollow (confirmed in source) | Very low | General server, disclose AI text | Optional |
| Pinterest | 1 to 2 h a week | Low | Nofollow (old reports), every pin links out | Unknown | Claimed site, 2:3 images | 6-week test, later |
| TikTok, Instagram, YouTube Shorts, Facebook groups | 2 to 5 h a week | Low to medium | None in posts | Very low (estimate) | Weekly video work | Skip for now |
| dev.to | 1 day an article | Low if the post teaches something; posts scored below -1 get `noindex` | Followed in post bodies; canonical honored | Low to medium, long tail (no public numbers) | Account | Do (weeks 3 and 5) |
| freeCodeCamp News | 2 to 3 days | Low | Followed | Not published (estimate: high long tail) | Application, 3 writing samples, original piece | Do (apply week 6) |
| JavaScript Weekly, Node Weekly | 15 min a submission | Low | Followed in the web archive | Not published | Submit form; editors choose | Do (week 3) |
| daily.dev | 30 min | Low to medium | Nofollow redirect | Spiky (one unverified anecdote: 67k impressions in 2 days) | Public Squad with admin approval; likely 250 reputation to post directly | Do, traffic only |
| Changelog News | 15 min | Low | Not checked | Not published | No tutorials or commercial products | Week 5, for an essay |
| Lobsters | 30 min | High if done wrong (invite tree, 25% rule) | `ugc noreferrer` | Site-wide 12k to 15k IPs a weekday (anecdotal) | Invite; 70 days before a new domain | Later |
| Hacker Noon | Half a day | Medium (link limits, ban for later link edits) | `ugc` | Not published | Editor review | Maybe, later |
| programming.dev (Lemmy) | 1 h | Low to medium | Nofollow | c/programming: 3,533 active a month | Comment history | Optional |
| Hashnode, Medium, Echo JS, Slashdot, Tildes, LinkedIn | Low | Low to medium | `ugc`, not verified, nofollow, followed, not checked, not verified | Low | Hashnode custom domain costs $5 a month; Tildes needs an invite | Skip for now |
| Data studies with writer pitches | 2 to 4 days each | Medium (third-party scores) | Followed, from citations | Medium spikes, long tail (estimate) | Study page, methodology, credits | Do (weeks 1 to 4) |
| Episode grid tool page | 2 to 4 days | Low | Followed, from coverage | Medium, steady (estimate) | Indexable landing page | After week 6 |
| "Best of" article pitches | 30 min each | Low if rare | Older MakeUseOf pieces followed; new How-To Geek and Tom's Guide nofollow | Low to medium if included | Clear home page pitch | With the study (week 4) |
| Journalist sourcing (Source of Sources, Qwoted free, #journorequest) | Ongoing | Low | Varies | Low, rare hits | A study to point to | After week 6 |
| Streaming newsletters (Cord Cutters News tips) | 30 min | Low | Varies | Short spikes | A newsworthy finding | Week 5 |
| Embeddable widgets and badges | Medium | Medium unless nofollow | Low by design | Low | Embed route | Skip; use chart credit lines instead |
| Wikipedia and Wikidata | n/a | High | Nofollow | Near zero | Independent coverage | Never |

## Rules and pitfalls

Each rule comes from Google's documentation or the platform's own rules page. The reports in [`backlinks/`](backlinks/) quote them.

### Google

1. **Never pay or trade for a link.** Google's [link spam policy](https://developers.google.com/search/docs/essentials/spam-policies#link-spam) (updated 2026-08-28) names "Exchanging money for links", "Exchanging goods or services for links", "Excessive link exchanges", and "Low-quality directory or bookmark site links". SpamBrain "neutralize[s]" such links, and their benefit "cannot be regained".
2. **No keyword anchors.** "Links with optimized anchor text in articles, guest posts, or press releases" and "Forum comments with optimized links in the post or signature" are link spam. Use the brand name or the bare URL.
3. **Widgets and badges get `nofollow` and a brand anchor.** "Keyword-rich, hidden, or low-quality links embedded in widgets" and "Widely distributed links in the footers or templates of various sites" are link spam.
4. **Point shares at indexable pages.** Links to `noindex, nofollow` list pages don't lead Google to title pages.
5. **Don't disavow.** "Most sites will not need to use this tool", and it "does not support Domain properties", which GoodWatch uses.
6. **Don't buy expired film-site domains** to redirect or rebuild. That is "expired domain abuse".
7. **Keep templated pages useful.** "Scaled content abuse" covers many generated pages "without adding value for users". Don't build one page per "is X on Netflix in Y" pair.

### Communities

8. **One account, run by the owner, always disclosed.** Say "I built this" every time. r/mcp and r/LocalLLaMA require disclosure, and Bluesky's guidelines require disclosing commercial content.
9. **Never ask for upvotes**, anywhere. That includes friends, Discord groups, and "upvote for upvote" deals. HN, Product Hunt, Reddit, Peerlist, and AlternativeTo all penalize vote manipulation, and Reddit can block the whole domain.
10. **Write every post and comment by hand.** HN, r/webdev, r/LocalLLaMA, r/mcp, r/cordcutters, and r/movies remove LLM-written posts. Reddit and mastodon.social require AI content to be disclosed, which also covers quoting the title analysis.
11. **Keep self-promotion under 10% of all activity**, counting comments. Reddiquette's 9:1 is now a rule of thumb, but many subs enforce it, and Reddit's spam policy asks owners to "be thoughtful about the frequency of posting".
12. **Don't post the same text in many places on the same day.** X calls "repeatedly posting identical or nearly identical posts" spam, and Reddit lists cross-community repetition.
13. **Don't name the account after the site.** r/movies bans for this and blacklists the domain.
14. **Never link GoodWatch in r/MovieSuggestions, r/televisionsuggestions, r/ifyoulikeblank, r/cordcutters, r/netflix, or r/movies.** These are instant-ban rules. Answer requests there in plain text only.
15. **No automation that interacts.** Bluesky allows bots only with a `bot` label, and they may only interact when someone tags them. X bans automated engagement "to drive traffic".
16. **Don't use link shorteners or redirects.** Reddit counts redirects that get around a domain block as spam, and Pinterest blocks "excessive or deceptive redirects".

### Data and attribution

17. **Credit the sources on every study, widget, and card.** That means the TMDB logo and its "not endorsed" notice, a JustWatch credit for streaming data, and "Information courtesy of IMDb (https://www.imdb.com). Used with permission." for IMDb data.
18. **Never offer IMDb, RT, or Metacritic data for download.** IMDb's terms forbid using the data to "create any kind of online/offline database of movie information". Publish findings, charts, and short lists only.
19. **Keep study pages free of ads, affiliate links, and sponsorship**, since IMDb and TMDB grant non-commercial use.

## Measure with free tools

Google doesn't document how fast a new link shows up or how much a link raises crawling. Google does document that "Discovery" crawls should rise after new content or a new sitemap. Judge over months, and line changes up against a log of link events.

1. **Keep a link event log** on #667: date, URL, link type, and target page.
2. **Each week (about 20 minutes):**
   - **Search Console Links:** export "Latest links", which is sorted by discovery date, and compare it with last week.
   - **Search Console Page indexing:** the indexed count, plus "Discovered - currently not indexed" and "Crawled - currently not indexed" counts.
   - **Search Console Crawl stats:** requests a day, Discovery versus Refresh, and host status.
   - **Search Console Performance:** impressions for the pages that got links, 28 days before versus after.
   - **Bing Webmaster Tools:** Backlinks and Referring domains, which is often fuller than Google's sample. IndexNow works for Bing and Yandex. Google doesn't support it.
   - **PostHog:** referrers by domain (news.ycombinator.com, reddit.com, t.co, go.bsky.app, producthunt.com, github.com, claude.ai), landing pages, and sign-ups by referrer.
3. **The goal Google can see:** fewer "Discovered - currently not indexed" pages, more Discovery crawls, and more indexed title pages than the 120 known URLs and 1.4 pages a day of October 2026.

## Open questions for the owner

1. **TMDB:** do you want to ask TMDB for a written agreement, or about how the terms apply, before promoting GoodWatch and its MCP server? Until then, do you want to hold the Claude and ChatGPT directory submissions? The low-key MCP Registry listing could still go ahead.
2. **Shared lists:** should shares lead Google to title pages? Options:
   - (a) Switch list pages to `noindex, follow`. This is a small change, but it decays over time.
   - (b) Make lists indexable when they pass a bar: an opted-in member, a custom title, and a short note.
   - (c) Keep lists as they are, and make every post and card also link a title page.

   Profiles would stay `noindex` either way.
3. **Accounts:** can your Hacker News account post a Show HN today? Do you have a Reddit account with history you want to use? Do you have a paid Claude plan for the directory submission?
4. **Studies:** is the critics-versus-audiences study the right first study, given that it draws attention to the RT and Metacritic crawler? The safer alternative is the per-country catalogue study, which uses TMDB and JustWatch data with credit.
5. **Owner time:** is 4 to 8 hours a week for six weeks realistic? If not, the minimum plan is moves 1, 2, 3, and 4, about 5 days in total.
6. **A home for write-ups:** do you want a small `/blog` on goodwatch.app for the originals, or should the articles live on dev.to only? A blog keeps the article's links to title pages internal and gives Hacker Noon and dev.to a canonical target on goodwatch.app. The minimum version is a few TSX routes like `about.tsx`, an RSS feed, and sitemap entries. The catch: Google's [canonicalization troubleshooting page](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting) says a canonical "is not recommended" for syndication and treats it as a hint. Google barely knows goodwatch.app today, so it may pick the dev.to copy as the original. If you choose a blog, publish there first and cross-post once URL Inspection shows the post indexed. The cheaper path is dev.to only, with every article linking the goodwatch.app pages it discusses.

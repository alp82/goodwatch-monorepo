# Startup and SaaS directory mega-lists, merged and graded

Scope: this report covers the "submit your startup to these 100+ directories" lists (GitHub repos, public spreadsheets and datasets, and directory-of-directories sites), merges them into one candidate set, grades the directories that appear on several lists, and filters them for a free consumer movie and TV site. Niche directories (AI tool directories, consumer app and web app galleries, entertainment directories, German and EU directories) belong to the companion report `01b-niche-directories.md`, except where they appear on the general lists. Research only: nothing was submitted, signed up for, or posted. All pages were read on 2026-10-21 unless a row says otherwise. The full graded table is [`01a-directories-graded.csv`](01a-directories-graded.csv).

## Summary

- **The mega-lists are mostly written by the directories they list.** Of 28 source lists, at least 17 are run by a launch board, a paid "submit to 100 directories" service, or an SEO tool, and several are near-identical copies. Merged, they name 1,963 domains. Only 373 appear on four or more lists, and only 155 of those are in the Tranco top 1 million.
- **The free dofollow link is almost always conditional.** On the launch boards graded, a free listing gets a followed link only if you put the directory's badge on goodwatch.app (20 boards, for example StartupBase, LaunchIgniter, PeerPush, Startup Fame, Open Launch, ToolFame), win a weekly vote, or pay $9 to $49. Google's link spam policy names "Excessive link exchanges" and "Exchanging money for links" as well as "Low-quality directory or bookmark site links". Don't add any badge, and don't buy a dofollow tier.
- **Only one free, unconditional followed link turned up:** SideProjects says its free launch "includes a do-follow backlink", and the listing checked was followed. Everything else worth doing is nofollow, a nofollow redirect, or not verified.
- **The lists' own link data is unreliable.** The largest dataset (921 rows) marks TinyLaunch, StartupBase, Open Launch, PeerPush, AppRater, and HUNT0 as "Dofollow". The live pages show badge or payment conditions, and AppRater sends visitors through a redirect that carries `X-Robots-Tag: noindex, nofollow`.
- **The ecosystem is new and self-referential.** Of the graded domains with a registration date, 43 of 107 were registered in 2024 to 2026 (29 in 2025 alone). Listing pages on many boards link out to other launch boards. ToolFame, SaaSFame, ProductFame, AIToolFame, and SubmitDone appear to share one operator (identical pricing text and cross-links).
- **The audience is founders, not film fans.** Expect a handful of visits per listing (estimate). Value for GoodWatch is mostly that Google sees a few more links to the home page, and a small chance that a writer browsing these sites picks GoodWatch up.
- **Graded:** 144 directories graded (plus 20 marked as done or graded in round 1). 29 pass the filter (4 "do", 16 "maybe", 9 "optional"). The first 5 take about 1.5 hours together. Below rank 12 the value per hour is close to zero.

## Source lists

"Size" is the number of distinct domains extracted from the list (after removing social networks, CDNs, and similar noise), with the list's own claim in brackets. GitHub repos under personal accounts are named by repo name only. "Last update" is the GitHub `pushed_at` date or the page's own date.

| Source list | Type | Size | Last update | Maintainer | Bias |
| --- | --- | --- | --- | --- | --- |
| awesome-launch (1,017 stars, Communities.md) | GitHub | 31 | 2026-06-23 | An individual | Community list of launch communities; least commercial |
| awesome-launch-platforms (263 stars) | GitHub | 34 | 2026-10-15 | DirectorySurf (organization) | Lists Altern second; run by a directory brand |
| awesome-saas-directories (254 stars) | GitHub | 55 | 2026-02-14 | An individual | Near-identical text to the 39-star copy below; Altern listed first |
| awesome-saas-directories (39 stars) | GitHub | 54 | 2025-07-22 | An individual | Copy of the 254-star list |
| ultimate-submit-list (152 stars) | GitHub | 103 [top 100 of submitlist.net] | 2024-07-23 | An individual | Funnel to submitlist.net; stale |
| awesome-saas-directories, "LaunchDB" (62 stars) | GitHub | 177 | 2026-10-19 | An individual | Funnel to its own launch database site |
| free-backlink-sources (40 stars) | GitHub | 73 | 2026-09-24 | An individual | Funnel to the author's "LaunchHub" page; SEO framing |
| startup-launch-platforms (26 stars) | GitHub | 62 [50+] | 2026-09-21 | An individual | SEO framing ("traffic, users, and backlinks") |
| startup-directories (28 stars) | GitHub | 117 | 2023-10-26 | An individual | Old; many dead entries |
| directory-submission-sites (16 stars) | GitHub | 163 [250+] | 2024-12-07 | An individual | Funnel to a paid directory submission tool |
| Awesome-SaaS-Directories (22 stars) | GitHub | 76 | 2026-03-17 | An individual | Homepage is a launch platform (JustHunt) |
| awesome-directories (48 stars) | GitHub | 28 | 2024-01-28 | directorieswiki (organization) | Mostly AI directories; stale |
| product-launch-platforms (13 stars) | GitHub | 56 | 2026-10-17 | ProductLaunchify (organization) | Lists its own launch platform second |
| product-hunt-alternatives (3 stars) | GitHub | 46 | 2026-09-26 | An individual | Homepage is Nick Launches |
| awesome-startup-launch-directories (15 stars) | GitHub | 25 [23, "2 free, 21 paid"] | 2026-10-13 | An individual | DR-ranked, mostly paid; maintainer also runs a tools directory |
| saascity-launch-kit | GitHub | 16 [150] | 2026-09-03 | An individual | SaaSCity's own kit |
| awesome-launch-directories (159 entries) | GitHub | 161 | 2026-10-12 | An individual | Funnel to a launch site |
| awesome-launch-directories (cost and self-promotion rules) | GitHub | 44 | 2026-09-25 | An individual | Funnel to a "where to launch" page |
| saas-directories (921-row CSV) | GitHub dataset | 921 | 2026-06-07 | An individual | Largest dataset; DR and "Dofollow" columns copied from directory marketing |
| awesome-directories-list | GitHub | 560 [589, live-checked 2026-10-12] | 2026-10-12 | An individual | Has a dated live check (413 working) |
| free-directory-submissions | GitHub | 1,182 | 2026-10-10 | An individual | "No login, no badge, no payment", mostly old general web directories: 294 domains appear on no other list |
| launch-directories (open dataset) | GitHub CSV | 26 | 2026-10-08 | An individual | Best data quality: free or paid, badge condition, and a `last_verified` date per row |
| LaunchDirectories (launchdirectories.com) | Directory of directories | 143 [100+] | 2026-10 | Company (sells a paid submission service) | Paid submission upsell |
| Submission Directory (submission.directory) | Directory of directories | 296 [100+] | 2026-10 | Company | DR and link-type columns, Spanish and English |
| Nick Launches Directory Finder (nicklaunches.com) | Directory of directories | 97 [156] | 2026-10 | Company (launch board) | Lists itself; sells launch services |
| SaaSCity submission list (saascity.io/saas-directory-submission-list) | Directory of directories | 113 [850+, "1,057 active"] | 2026-10 | SaaSCity (launch board) | Lists itself; its own counts disagree |
| Startups.fm blog, best free startup directories | Blog list | 36 | 2026 | Startups.fm (same owner as Tiny Startups) | Lists its own sites |
| ListingBott (listingbott.com) | Directory of directories | 35 | 2026-10 | ListingBott (paid submission service) | Sells automated submissions |

Not used: awesome-directories.com (300+ directories) keeps its data in a database the page loads after sign-up checks, so it could not be read without a browser. The Indie Hackers post "261 free launch platforms" links a hypedesk.io page that rendered only 7 domains to curl. LaunchIgniter's "932+ submit directories" page is an SEO page on a graded launch board.

## How the candidates were graded

1. Extracted every outbound domain from the 28 lists and counted on how many lists each appears (working file: `candidates.csv`, 1,963 domains).
2. Fetched the home page of all 373 domains on four or more lists in parallel with curl and recorded status, redirects, title, and dates on the page.
3. Picked 127 general startup, SaaS, product, and app directories from those, plus 17 others (consumer-relevant "similar sites" finders and dead entries). AI-only directories were left to `01b`.
4. For each, read the site's own submit, pricing, FAQ, or `llms.txt` page, and read the `rel` on a listed product's own website link in a real listing page. Where the link went through a `/visit/` or `/r/` redirect, the redirect's status code and headers were read too.
5. Added the Tranco rank (list 262W9, created 2026-10-20) and the domain registration date from RDAP (IANA bootstrap servers).

Limits: server HTML only (links that JavaScript adds later were not seen); many listings don't show whether they are free or paid, so "dofollow observed" can mean a paid listing; "indexed in Google" was not checked, because there is no free way to query Google's index at this scale. Treat traffic numbers on these sites (several show their own analytics widgets) as their claims.

## Ranked list: directories worth doing

Ranked by value per owner hour. Effort includes finding screenshots and writing a plain description. "Referral value" is an estimate for a consumer movie site on a founder-audience board. "Flag" marks every directory that offers dofollow only for a badge, a vote win, or money. Take the free path in each case, and never add the badge.

### Do (about 1.5 hours for all five)

| # | Directory | Submission URL | Cost (free path) | Effort | Link type (checked on) | Referral value | Risk | Flag | Lists |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SideProjects | https://sideprojects.net/projects/submit | Free, queue "usually within a few weeks"; $29 to pick a date | 20 min | Dofollow (stated for free launches; seen on /projects/snapkin) | Low: maker audience, up to 10 launches a day | Low | Paid options exist, but the free launch gets dofollow with no condition | 5 |
| 2 | AppRater | https://apprater.net/about | Free to submit, publish, and stay; optional paid promotion | 15 min | Redirect: `/visit/<slug>` returns 307 with `X-Robots-Tag: noindex, nofollow` (on /a/canopio). Treat as not followed | Low: consumer app archive, 12,404 listings, 1,533 added in the last 30 days | Low: says it has been online since 2011 and that money never decides publication | None | 6 |
| 3 | HUNT0 | https://hunt0.com/submit | Free, 70 slots a week | 20 min, plus checking the launch week | Nofollow for free launches; dofollow only for the weekly top 20. Marks Premium links `sponsored` and badge links `nofollow` | Low | Low: the only board found that labels paid and badge links the way Google asks | Vote-gated dofollow | 4 |
| 4 | Alternative.me | https://alternative.me/how-to/submit-software/ | Free with an account | 15 min | Nofollow (on /justwatch) | Low: has a JustWatch alternatives page that targets "alternatives to JustWatch" searches | Low | None | 7 |
| 5 | SiteLike | https://www.sitelike.org/add-site | Free; automatic check, manual review for "similar to" suggestions | 10 min | Nofollow (on /similar/justwatch.com/) | Very low: auto pages, but they sit on "sites like JustWatch" searches | Low to medium (thin automated pages; `01b` rates this class high risk). Nofollow, so no link-spam exposure | None | 6 |

SiteLike is graded "maybe" in the CSV because its pages are automated. It is in this group because it takes 10 minutes and its pages match consumer intent.

### Maybe (about 15 to 20 minutes each, if you have the time)

| # | Directory | Submission URL | Cost (free path) | Link type (checked on) | Referral value | Risk | Flag | Lists |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | Startup Ranking | https://www.startupranking.com/startup/new | Free listing; paid Faster Approval, Booster, Premium Profile | Followed on an established listing (/startup/anthropic); free-tier link not verified | Low: founders and investors | Medium: sells SEO boosters | Paid upsells | 8 |
| 7 | Trendy Startups | https://trendystartups.com/faq | Free review with a backlog; paid expedited review | Followed (on /startups/Streamkap, tier unknown) | Low | Low to medium. The submit URL returned HTTP 500 on 2026-10-21 | Paid speed | 4 |
| 8 | TinyLaunch | https://tinylaunch.com/submit | Free weekly launch | Nofollow (free listing /launch/22359-udonboost) | Low: on 15 source lists, so it is the most visited of the weekly boards (estimate) | Medium | Badge or $39 for dofollow | 15 |
| 9 | Launch Llama | https://tools.launchllama.co/pricing | Free listing, reviewed in about 4 weeks | Free link not verified; dofollow sold at $39 | Low: claims a 20,000-subscriber founder newsletter | Medium: sells directory backlink packages | Paid dofollow | 10 |
| 10 | Awesome Indie | https://awesomeindie.com/pricing | Free next slot in the queue | Nofollow (on /product/biovelt); dofollow at 20 upvotes | Low | Low to medium | Vote-gated dofollow | 9 |
| 11 | Startup88 | https://startup88.com/submit-startup | Free form (not verified) | Nofollow (`rel="nofollow external"` on a 2026-10-11 post) | Low: each startup gets a written post | Low to medium; domain registered 2013 | None found | 6 |
| 12 | Sidehunt ("Nofollow launch") | https://sidehunt.io/faq | Free, no badge, reviewed | Nofollow (on /project/interview-vip) | Low | Medium: one of five near-identical weekly hunts (Sidehunt, MakerHunt, EarlyHunt, IndieHunt, Aura++). Use one at most | Badge or $19 for dofollow | 7 |
| 13 | Neeed Directory | https://neeed.directory/submit | Free, live after an automatic check | Nofollow without the badge (stated) | Very low | Medium: registered 2025-10 | Badge or $19 for dofollow | 10 |
| 14 | Saaspa.ge | https://saaspa.ge/promote-now | Free weekly cohort | Nofollow (stated) | Very low | Medium | Top 3 or $9 for dofollow | 5 |
| 15 | Better Launch | https://betterlaunch.co/pricing | Free Monday launch, at least 30 days out | Nofollow (stated) | Very low | Medium | Badge or payment for dofollow | 4 |
| 16 | Built By Indies | https://builtbyindies.com/pricing | Free next open week; permanent listing | Nofollow for free (inferred) | Very low | Medium: registered 2025-12 | Top 3 or $19 for dofollow | 4 |
| 17 | Shipyard HQ | https://shipyardhq.dev/pricing | Free public page with analytics | Redirect: `/r/<slug>` returns 307 with `X-Robots-Tag: noindex, nofollow` | Very low | Low to medium | Paid boosts | 4 |
| 18 | What Launched Today | https://whatlaunched.today/auth/signup | Free launch, standard queue | Not verified (product link not in server HTML) | Very low | Medium: registered 2025-07 | Paid premium | 4 |
| 19 | StackShare | https://stackshare.io | Free stack profile (not verified) | Not verified (Vercel bot check, HTTP 429) | Low, developer audience; useful only next to the engineering articles | Low | Not verified | 10 |
| 20 | Open SaaS Directory | https://opensaas.directory/projects/new | Free (not verified) | Followed (on /projects/keploy) | Very low | Medium. Fit unclear: it lists self-hostable open-source SaaS, and GoodWatch is MIT but not packaged for self-hosting | None found | 6 |

### Optional (10 to 15 minutes each, near-zero value)

These have a free path, but each is either founder-only, unverified, or run by a seller of link services. Do them only if you already have the copy and screenshots open.

| # | Directory | Submission URL | Free path | Link type | Why it's only optional | Lists |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | startuups | https://startuups.com/pricing | Free weekly launch | Dofollow for weekly winners or premium | Open-launch template, registered 2025-12 | 5 |
| 22 | OpenHunts | https://openhunts.com/pricing | Free Monday launch (not verified) | Product link not verified; sidebar links `sponsored` | Same template | 11 |
| 23 | FoundrList | https://www.foundrlist.com/pricing | Free forever, queued | Not verified; dofollow sold ($49 to $403) | Paid-link upsells | 8 |
| 24 | Huzzler | https://huzzler.so/advertise | Free startup page | Not verified; dofollow sold ($49/month and up) | Sells "AI visibility" articles | 6 |
| 25 | SaaSCity | https://saascity.io | Free directory listing | Not verified; ads are `sponsored nofollow` | Also sells submission help | 9 |
| 26 | Nick Launches | https://nicklaunches.com/submit/ | Free submission (terms not verified) | Followed (on /products/snap-ai-studio/) | Launch-service operator | 11 |
| 27 | Versily | https://versily.com/pricing | Free plan | Nofollow (on /products/gomodel) | Pricing JS-only | 4 |
| 28 | LibHunt | https://www.libhunt.com/repo/submit | Free repo submission | Links point to GitHub | Lists the repo, not the site | 4 |
| 29 | Crunchbase | https://www.crunchbase.com | Free organization profile | Not verified | Investor audience; an entity profile, not traffic | 14 |

The brief asked for 30 to 60. Only 29 directories passed the filter, and the honest cut-off for owner time is rank 12.

### Already done or graded in round 1 (not regraded)

| Directory | Status | Round 1 finding |
| --- | --- | --- |
| AlternativeTo, SaaSHub, Launching Next, Tiny Startups | Done (submitted) | AlternativeTo followed for established listings, nofollow for small; SaaSHub nofollow; Tiny Startups nofollow observed |
| Product Hunt, Uneed, Peerlist, Microlaunch, Fazier, BetaList, DevHunt, Indie Hackers, There's An AI For That, Futurepedia, OpenAlternative | Graded in round 1 | See `../backlinks/01-launch-platforms.md` |
| Hacker News, Reddit, DEV Community, HackerNoon, Lobsters | Other round 1 channels | See `../backlinks/02-reddit-forums.md` and `07-dev-platforms.md` |

These are among the most-listed domains (Product Hunt is on 23 lists, BetaList 23, Indie Hackers 21, Launching Next 20), so round 1 already covered the top of the merged list.

## Recommended moves

Ranked by value per owner hour.

1. **One sitting, about 1.5 hours: SideProjects, AppRater, HUNT0, Alternative.me, and SiteLike.** Write one plain 50-word description, one 160-character tagline, and three screenshots (home, a title page with the three scores, a streaming-by-country view) first, and reuse them. SideProjects is the only free, unconditional followed link in this channel. AppRater is the only one with a consumer app audience and a human reviewer. Alternative.me and SiteLike put GoodWatch on "alternatives to JustWatch" pages, which match what GoodWatch replaces. Link the home page, not a list or profile page (those are `noindex, nofollow`).
2. **Later, about 1.5 to 2 hours: ranks 6 to 12** (Startup Ranking, Trendy Startups, TinyLaunch free, Launch Llama free, Awesome Indie, Startup88, one Sidehunt-network "Nofollow launch"). Each is free and badge-free. Value is mostly a few extra discovered links to the home page, and a small chance that a founder-blogger sees GoodWatch. Schedule weekly-board launches in different weeks so they don't stack.
3. **Skip everything else in this channel.** Ranks 13 to 29 cost 15 minutes each and return almost nothing for a consumer site. The time is better spent on the data study and dev.to articles from round 1, which are the only repeatable sources of followed editorial links.
4. **Rules for every submission:**
   - Never add a directory badge or a link back, even when it is the only free path. That is a link exchange in Google's terms.
   - Never buy a "dofollow", "DR 70+", or "permanent backlink" tier, and never buy a "submit to 100 directories" package (PeerPush, Findly, Noonlaunch, Launch Llama, trylaunch.ai, and others sell them).
   - Never ask anyone to upvote on the weekly boards.
   - Use the brand name "GoodWatch" as the listing name, not keywords.

## Skip list

Grouped by the main reason. Details and evidence are in the CSV.

| Reason | Count | Directories |
| --- | --- | --- |
| Dead, parked, or hijacked | 17 | Slant (HTTP 526), Launched, Cool Startups, Platforms Directory, Demos, Software Select HQ (no DNS), Betafy (no response), New Startups (523), Tool Salad (522), StartupLift (empty page), Startup Inspire (submit page is its 404), KillerStartups (now a news blog), StartupWizz (now an unrelated gambling-tips site), Project Hatch (redirects to a finance site), ProductBurst and Startup Lister (Bubble error pages), Insanely Cool Tools (parked) |
| Reciprocal link or badge required for the free listing or its dofollow | 20 | StartupBase, LaunchIgniter, PeerPush, Startup Fame, Twelve Tools, Startup Fast, Toolfio, ToolFame, SaaSFame, ProductFame, Webspot, Open Launch (free also booked into 2027), Firsto, Launch Vault, DailyPings, StartupTrusted, Confetti SaaS (its agent installs the badge), Micro SaaS Examples, Smol Launch, Aura++ |
| Paid only | 7 | PitchWall (formerly BetaPage, $49), Startups.fm (GBP 49), AllTopStartups (free listings suspended), Postmake, IndieProducts, Turbo0, TechPluto (paid reviews) |
| Link farm or link seller | 17 | Findly, Noonlaunch, NXGN Tools, RankInPublic, SumoDir ("+25 domain rating on average"), Shipybara and Startups Lab (listing pages ring-link other launch boards), Stellar Launch, IndieHub, the paid app-review network AppsThunder, Appiod, WebAppRater, AlphaDigits ($249 "network review" on 10 sister blogs), and old general web directories Submission Web Directory (reciprocal tier), SoMuch.com, ExactSeek, Active Search Results. These match Google's "low-quality directory" wording |
| Wrong audience | 27 | B2B software review sites (Capterra, G2, GetApp, TrustRadius, SourceForge, Crozdesk, SoftwareSuggest, SaaSworthy, FinancesOnline, GoodFirms, Slashdot's software directory), founder and investor platforms (F6S, Wellfound, StartupBlink, SideProjectors, AppSumo, Indie.Deals), niche tool lists (Startup Stash, NoCodeList, Productivity Directory, resource.fyi, BuildVoyage, Indie Hacker Stacks, MarsX, Sidebar), ThePopularApps (games), Brownbook (local business) |
| Low value | 27 | Duplicate weekly hunts (MakerHunt, EarlyHunt, IndieHunt), stale or unverifiable boards (Startup Buffer, ctrlalt.cc, Joinly, SnapMunk, Promote Project, 10words, 1000.tools, Worm, SoloPush, Super Launch, Startup Listing, Product Watch, Scout Forge, Startup Collections, Toolfolio, trylaunch.ai), WIP, GrowthHackers, AllMyFaves (no submission path), Webwiki, and automated similar-site finders with no submission path (Similarsites, SimilarSiteSearch, TopSimilarSites, Alternative.tools) |

## Open questions for you

1. **Badges:** do you agree to a blanket "no badges on goodwatch.app" rule? It closes the free path on 20 boards, which is the point.
2. **Time:** is 1.5 hours for the five "do" items worth it, given that four of the five links are nofollow? If owner time is tighter than that, do SideProjects and AppRater only (35 minutes).

## Sources

All accessed 2026-10-21.

- Google link spam policy: https://developers.google.com/search/docs/essentials/spam-policies#link-spam
- Tranco list 262W9 (created 2026-10-20): https://tranco-list.eu/top-1m.csv.zip and https://tranco-list.eu/api/lists/date/latest
- RDAP bootstrap: https://data.iana.org/rdap/dns.json (registration dates per TLD server)
- Source lists on GitHub, read with `gh api` (search GitHub for the repo names in the source list table): awesome-launch, awesome-launch-platforms (DirectorySurf: https://github.com/DirectorySurf/awesome-launch-platforms), awesome-saas-directories (several copies), ultimate-submit-list, startup-launch-platforms, startup-directories, directory-submission-sites, Awesome-SaaS-Directories, awesome-directories (directorieswiki: https://github.com/directorieswiki/awesome-directories), product-launch-platforms (ProductLaunchify: https://github.com/productlaunchify/product-launch-platforms), product-hunt-alternatives, awesome-startup-launch-directories, saascity-launch-kit, awesome-launch-directories (two repos), saas-directories, awesome-directories-list, free-directory-submissions, free-backlink-sources, launch-directories; awesome-directories (awesome-directories organization: https://github.com/awesome-directories/awesome-directories)
- Directory-of-directories sites: https://launchdirectories.com, https://submission.directory, https://nicklaunches.com, https://saascity.io/saas-directory-submission-list, https://startups.fm/blog/best-free-startup-directories, https://www.listingbott.com, https://awesome-directories.com, https://www.indiehackers.com/post/ive-built-a-huge-list-of-261-free-launch-platforms-and-directories-where-you-can-submit-your-startup-b1e856991d
- Recommended directories, rules pages: https://sideprojects.net/pricing, https://sideprojects.net/llms.txt, https://apprater.net/about, https://apprater.net/llms.txt, https://hunt0.com/submit, https://alternative.me/how-to/submit-software/, https://www.sitelike.org/add-site, https://www.startupranking.com/startup/new, https://trendystartups.com/faq, https://tinylaunch.com/submit, https://tools.launchllama.co/pricing, https://awesomeindie.com/pricing, https://startup88.com/submit-startup, https://sidehunt.io/faq, https://neeed.directory/submit, https://saaspa.ge/promote-now, https://betterlaunch.co/pricing, https://builtbyindies.com/pricing, https://shipyardhq.dev/pricing, https://whatlaunched.today/llms.txt
- Listings checked for link type: https://sideprojects.net/projects/snapkin, https://apprater.net/a/canopio (and its /visit/canopio redirect headers), https://hunt0.com/products/imageat, https://alternative.me/justwatch, https://www.sitelike.org/similar/justwatch.com/, https://startupranking.com/startup/anthropic, https://trendystartups.com/startups/Streamkap, https://tinylaunch.com/launch/22359-udonboost, https://awesomeindie.com/product/biovelt, https://startup88.com/startups/2026/10/11/signpricer/95561, https://sidehunt.io/project/interview-vip, https://neeed.directory/products/phprunner, https://shipyardhq.dev/products/kalen (and its /r/ redirect headers), https://opensaas.directory/projects/keploy
- Skip-list evidence (pricing, FAQ, and submit pages): https://startupbase.io/launch, https://launchigniter.com/pricing, https://peerpush.com/pricing, https://startupfa.me/pricing, https://twelve.tools/submit, https://open-launch.com/pricing, https://firsto.co/pricing, https://launchvault.dev/pricing, https://dailypings.com/pricing, https://toolfame.com/pricing, https://webspot.app/pricing, https://pitchwall.co/submit, https://startups.fm/submit, https://alltopstartups.com/submit-startup/, https://noonlaunch.com/pricing, https://findly.tools/llms.txt, https://www.submissionwebdirectory.com/submit.php, https://somuch.com/submit-links/, https://appsthunder.com/submit-your-app/, https://sumodir.com/pricing; every other row's URL is in the CSV

# Niche directories for GoodWatch (round 2, part 1b)

This report covers niche directories that fit a consumer movie and TV site: AI tool and AI agent directories, ChatGPT and Claude app mirrors, MCP Apps galleries, web app and PWA galleries, curated "useful websites" collections, alt-search lists, movie and TV resource lists (Trakt, Letterboxd, Plex, Jellyfin, FMHY, cord-cutting sites), university library guides (LibGuides), and German and EU directories. General startup and SaaS mega-lists are in part 1a. Round 1 items are not repeated: There's An AI For That, Futurepedia, Glama, mcp.so, mcpservers.org, Smithery, PulseMCP, MCP Market, the awesome MCP lists, and the official Claude and ChatGPT directories are in [`../backlinks/01-launch-platforms.md`](../backlinks/01-launch-platforms.md) and [`../backlinks/04-listings-registries.md`](../backlinks/04-listings-registries.md). Research only: nothing was submitted, posted, or sent. Every item is graded in [`01b-niche-directories-graded.csv`](01b-niche-directories-graded.csv) (122 rows). All sources were accessed on 2026-10-21. Tranco ranks come from list 262W9, downloaded on 2026-10-21. "Followed" means the outbound `<a>` had no `nofollow`, `ugc`, or `sponsored` value in the server HTML checked. Traffic and fit are estimates unless a number is quoted.

## Summary

- **Niche directories are a thin channel for GoodWatch.** Of 122 graded items, 3 are worth doing now and about 14 more are worth doing later or under a condition. The rest are paid, nofollow, dead, or built for a different kind of site.
- **The best free followed links in this channel are the EU-alternatives directories.** European Alternatives (Tranco 151,898) and Go European both showed followed product links, both are free, and both are reviewed by people. GoodWatch fits as "a European alternative to IMDb, Rotten Tomatoes, and Letterboxd", since goodwatch.app is hosted by Hetzner in Falkenstein, Germany. Neither has a movie category, so expect few visitors.
- **FMHY's Video page is the only film-buff tool index with followed links and real traffic** (fmhy.net, Tranco 33,335, `rel="noreferrer"` on FlickMetrix and other small movie sites). Staff test every addition. FMHY is mainly a piracy index, so listing there needs an owner decision.
- **AI tool directories are almost all pay-to-play.** Eight of the 35 checked sell a followed link or require a link back to give one. The useful AI-side finds are two mirrors of the official directories, Claude Market (followed) and Node8 (nofollow). Both copy official listings by themselves, so they cost nothing once GoodWatch's Claude and ChatGPT listings are public. On 2026-10-21, claude.com/marketplace/connectors/goodwatch returned 404.
- **University library guides link small tools with followed links on strong domains, but rarely add new ones.** All 13 LibGuides checked had followed links (Harvard, Penn, UC Santa Barbara, University of Oregon, and others), but they list only JustWatch, Reelgood, Letterboxd, IMDb, Rotten Tomatoes, and Metacritic. None has a "suggest a site" form. One short note per institution, after the data study is public, is the only sensible move.
- **WebCatalog is the one clean consumer web-app catalog.** It is free, reviewed, and lists Letterboxd and JustWatch, but its links are nofollow. The value is visitors only.
- **Two things on GoodWatch's side block parts of this channel.** The blog feed (`/blog/rss.xml`) has no items yet, which rules out blog directories such as ooh.directory. The web manifest is served from `static.goodwatch.app` with `start_url` and `scope` set to `/`, and the site has no service worker, which rules out PWA directories and the Microsoft Store for now.
- **Trakt, Letterboxd, Plex, and Jellyfin have no app lists that GoodWatch can join.** Trakt's apps page is gone (404 since the move to app.trakt.tv). Letterboxd's API page excludes recommendation, data-visualization, and LLM projects. Jellyfin and Plex lists need an integration GoodWatch doesn't have. The Trakt and Plex forums are open, but their links are `nofollow ugc`.

## Detailed tables

The CSV has every field for every item, including the exact listing each link type was checked on. These tables show the items with a Do or Maybe verdict, plus the notable Skips. "Effort" is an estimate of owner time.

### AI tool, AI agent, ChatGPT, Claude, and MCP Apps directories

| Name | Cost | Link type (listing checked) | Tranco | Fit | Effort | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Market (claudemarket.ai) | Mirror is free and automatic. The submit page says "Basic listing is free", but the visible options are $10 one-time ("No backlink needed") and $79 a month, which suggests the free path needs a backlink (not verified) | Followed, `rel="noopener noreferrer"` (Entertainment category page, links to credits.fm and others) | Not in top 1M | Medium. Has an Entertainment category. Claims 50k+ visitors a month (its own claim) | 0 h (wait for the mirror) | Maybe, passive |
| Node8 (node8.ai) | Free, no submission | Nofollow (Achriom and Cinemo listings) | Not in top 1M | Medium. Its Entertainment and Media category lists rivals Achriom and Cinemo. Mirrors 2,289 ChatGPT apps plus Claude connectors | 0 h | Maybe, passive |
| ChatGPTAppsRank | Free form | None: listing pages have no outbound link to the app's site (Canva listing) | Not in top 1M | Medium, consumer ChatGPT users. Only for apps approved in ChatGPT | 15 min | Maybe, after ChatGPT approval |
| Future Tools (futuretools.io) | Free | None for ranking: the visit button is a `/go/` redirect that robots.txt disallows (AutoDraw listing) | 188,432 | Low to medium, AI enthusiasts. Most submissions are rejected (FAQ, via search summary) | 15 min | Maybe, visitors only |
| The Rundown Supertools | Free, by email | Followed, `rel="noopener noreferrer"` (AgentCard listing) | 172,757 (therundown.ai) | Low. The tools lean toward work software | 15 min | Maybe, low odds |
| a2ui.me (MCP Apps, 964 entries) | No submission path found | Followed, but to the GitHub repo, not the product site | Not in top 1M | Low to medium. A movie MCP app is already listed under Media | 0 h | Maybe, links the repo only |
| Toolify, Easy With AI, AI Agents List, OpenTools, FindMyAITool | $49 to $499 | Followed only when paid | 49,403 to not ranked | Low | n/a | Skip (paid link) |
| Dang.ai, Toolpilot | Free only with a link back | Followed, in exchange for a link back | 222,672 and 547,958 | Low | n/a | Skip (reciprocal link) |
| TopAI.tools, AI Agents Directory, AI Agent Store, AIxploria, AI Agents Listing | Mostly paid or unclear | Nofollow on the listings checked | 207,629 to not ranked | Low | n/a | Skip |
| GPTStore.ai, GPTs Works, GPTs Hunter, Ben's Bites directory, AI Tool Hunt | n/a | n/a | n/a | None | n/a | Skip (dead, pivoted, or custom GPTs only) |

### Consumer web app, PWA, curated, and alt-search directories

| Name | Cost | Link type (listing checked) | Tranco | Fit | Effort | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| WebCatalog (webcatalog.io) | Free: "No fees and no paid plan" | Nofollow, `rel="noopener nofollow"` (Letterboxd and JustWatch listings) | 41,875 | Medium. Consumer audience, indexed pages next to Letterboxd and JustWatch | 15 to 20 min | Do |
| Curlie, Arts > Movies > Databases | Free, volunteer editors | Followed (archived category page, capture 2021-09-16). Live site returned 503, 502, and timeouts on 2026-10-21 | 146,530 | High. The category is movie databases (IMDb, AllMovie) | 15 min | Maybe, when the site responds |
| Store.app | Not verified (its "Get Listed" page returned 502) | Followed, `rel="noreferrer noopener"` (Duolingo listing) | Not in top 1M | Medium. Has an Entertainment category | 15 min | Maybe, recheck terms first |
| Microsoft Store via PWABuilder | Free for individual developers since 2025-09-10 | Website URL rendered by JavaScript (Spotify listing, not verified) | 8 (microsoft.com) | Medium. Windows users | 3 to 6 h, after the PWA fixes | Maybe, later |
| ooh.directory | Free, one curator | Followed (a Movies-category blog listing) | 932,038 | Medium for the blog. Arts > Movies has 60 blogs | 5 min | Maybe, once the feed has posts |
| Feedle | Free (not verified) | Not verified | 296,139 | Low to medium | 5 min | Maybe, once the feed has posts |
| Web Curios (weekly curated blog) | Free, editorial | Followed (95 links in the 2026-10-16 post, none with `rel`) | Not in top 1M | Medium. Readers who like odd, useful web things | 20 min | Maybe, with the passport study |
| Kagi Small Web, Kagi bangs, DuckDuckGo bangs, Wiby, searchmysite, Marginalia | Free or paid | None, or not applicable | 417 to 894,873 | Low | n/a | Skip (personal sites only, or "Low-traffic independent sites, such as startups" excluded) |
| One Page Love, Minimal Gallery, Land-book, Awwwards, CSS Design Awards | Free to $50+ | Followed on some | 11,767 to 579,498 | Low, designers | n/a | Skip |
| Jasmine Directory, Best of the Web | About $59 to $150 a year | Not verified | 143,143 and 111,063 | Low | n/a | Skip (paid directory) |

### Movie and TV resources

| Name | Cost | Link type (listing checked) | Tranco | Fit | Effort | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| FMHY Video page (fmhy.net) | Free. GitHub issue on the FMHY edit repo, or Discord. "We don't accept any paid or free trial only entries" | Followed, `rel="noreferrer"` (fmhy.net/video, FlickMetrix link) | 33,335 | High. Lists FlickMetrix, MDBList, Series Graph, and other small movie sites. A 2026-03 submission was set aside for looking like "another TMDB frontend" | 30 min | Maybe, needs an owner decision (piracy index) |
| Trakt forum, 3rd Party > Other | Free | `nofollow ugc` (two topics) | 18,552 (trakt.tv) | Medium. 37 topics, top topics 1k to 2.4k views | 1 to 2 h | Maybe, visitors only |
| Plex forum, Dev API Corner | Free | `nofollow ugc` (one topic) | 1,896 (plex.tv) | Low to medium. GoodWatch uses the plex.tv API for Plex connect, so a developer write-up fits | 1 to 2 h | Maybe, visitors only |
| UC Santa Barbara Library: Streaming video, other sources | Free. Guide owner's contact box | Followed (reelgood.com, justwatch.com/us) | 3,041 (ucsb.edu) | High. The page calls JustWatch US-focused, and GoodWatch covers 139 countries | 20 min | Maybe, after the study |
| University of Pennsylvania Libraries: Cinema and Media Studies guide, and Streaming Video FAQ | Free. Guide owner's contact box | Followed (justwatch.com, reelgood.com, letterboxd.com) | 1,178 (upenn.edu) | High | 20 min, one note for both | Maybe, after the study |
| University of Oregon Libraries: Video search engines | Free. Guide owner's contact box | Followed (reelgood.com, justwatch.com) | 4,431 (uoregon.edu) | High. The closest category match | 20 min | Maybe, after the study |
| Hood College Library: Film studies web resources | Free. Guide owner's contact box | Followed (letterboxd.com, metacritic.com, rottentomatoes.com) | 9,390 (libguides.com) | High. Its review-sites section fits the combined-score pitch | 20 min | Maybe, after the study |
| Harvard Library: Using Video, Find Streaming | Free. Guide owner's contact box | Followed (reelgood.com, justwatch.com) | 316 (harvard.edu) | High, very low odds | 20 min | Maybe, after the study |
| Butte College Library: Film guide | Free | Followed | 9,390 (libguides.com) | Medium | 20 min | Maybe, low |
| Trakt apps page, Letterboxd API apps, Simkl apps, MDBList, Jellyfin clients, awesome-jellyfin, Plexopedia | Free | n/a, or needs an integration | 1,054 to not ranked | n/a | n/a | Skip |
| Penn German film guide, AFTRS, Louisburg College, Chippewa Valley Technical College, UC Berkeley, Mt. San Antonio College | Free | Followed, but the Penn German film page is `noindex,nofollow` | Various | Low to medium | n/a | Skip |
| Grounded Reason, CordCutting.com, subreddit wikis | Free | Not verified, or `nofollow ugc` | 223,798 to not ranked | Medium | n/a | Skip (no tool lists; editorial pitches belong to channel 05) |

### German and EU directories

| Name | Cost | Link type (listing checked) | Tranco | Fit | Effort | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| European Alternatives | Free, needs an account. Suggestions through the in-site tool | Followed, `rel="noopener"` (Qwant listing; rechecked by the lead) | 151,898 | Medium-low. No movie category; 108 "alternative to" pages, none for IMDb, Letterboxd, or JustWatch. The company must be based in the EU, EEA, EFTA, or the UK | 30 min | Do |
| Go European | Free, donation-funded. Volunteers review every submission | Followed, no `rel` (Lignina listing) | Not in top 1M | Medium-low. Has Media categories | 15 min | Do |
| Only EU (German-language) | Free | Followed, `rel="noopener noreferrer"` (MUBI listing) | Not in top 1M | Medium. Has a Streaming category (MUBI, RTL+), but GoodWatch is a guide and its UI is English only | 15 min | Maybe |
| switching.software | Free, Codeberg issue | Followed (LibriVox listing) | Not in top 1M | Low-medium. Its privacy criteria may not fit GoodWatch's analytics. 115 open issues | 30 min | Maybe, low |
| Caschys Blog (stadt-bremerhaven.de) tip form | Free, editorial | Followed in article bodies; sponsored links are `nofollow sponsored` | 40,152 | Medium. Large German tech audience with a Streaming section | 20 min, with a story | Maybe, with a German finding |
| WEB.DE Magazin | Free, editorial. No tip form found | Followed (its 2022 film-finder roundup links JustWatch, werstreamt.es, Letterboxd, taste.io) | 2,449 | Medium-high | 30 min | Maybe, pitch for a new piece |
| deutsche-startups.de, Basic Thinking, t3n | Free, editorial | Followed in bodies (t3n not verified) | 153,761, 78,914, 15,605 | Low-medium | 20 min each | Maybe, low |
| euacc.ai | EUR 39 for a "Direct do-follow website link" | Paid followed | Not in top 1M | Low | n/a | Skip (paid link) |
| Startbase, Gründerszene database, Gründerküche, StartupBrett, EU-Startups, Startup Europe, Berlin Startup Map | Free or not verified | None, hidden behind a login, or not verified | Various | Low, investors | n/a | Skip |
| webwiki.de and German "Webkatalog" sites | Often free with a reciprocal link, or paid | Followed on webwiki.de | 62,376 and lower | None | n/a | Skip (link-farm signs) |

## Flags: payment or a reciprocal link for a followed link

Google's [link spam policy](https://developers.google.com/search/docs/essentials/spam-policies#link-spam) names "Exchanging money for links", "Excessive link exchanges", and "Low-quality directory or bookmark site links". Don't use these paths:

| Site | What it asks for |
| --- | --- |
| Toolify | $99 one-time; dofollow per third-party reports |
| Easy With AI | $125: "The link to your tool will be dofollow" |
| AI Agents List | $49: "Permanent dofollow link from our DR 40 domain" |
| OpenTools | Paid subscription: "Strong on-topic backlink" |
| FindMyAITool | $79.99 to $499.99, sold as backlinks |
| AI Agents Listing | Paid upgrade for dofollow |
| AItoolnet | Sells "Do-Follow SEO backlink" as the feature |
| euacc.ai | EUR 39 "Direct do-follow website link" |
| Dang.ai | Free tier "Requires a crawlable backlink to dang.ai" |
| Toolpilot | "A link back to our site is now mandatory for all free listings" |
| Claude Market | Free tier probably needs a backlink (not verified); $10 removes the requirement. Wait for the automatic mirror instead |
| German Webkataloge | Reciprocal link or paid placement |

## Owner decisions this channel raises

1. **FMHY.** Do you want GoodWatch listed on a wiki that is mainly a piracy index? The link is followed and the audience fits. The catch is brand association, which matters if you ask TMDB about the API terms.
2. **The EU framing.** Do you want to present GoodWatch as "a European alternative to IMDb, Rotten Tomatoes, and Letterboxd"? European Alternatives asks for the company's location. Check that a sole trader in Germany counts. Only the web server's location was checked (Hetzner, Falkenstein). PostHog, email, and AI providers were not checked, so don't claim "EU hosted" for the whole service.
3. **Library outreach.** A note to a librarian counts as outreach, so send it yourself and only after the data study is public. Keep it to one note per institution.
4. **PWA fixes.** Do you want GoodWatch to be installable? That needs a service worker and a manifest on goodwatch.app (or a manifest whose `start_url` and `scope` are absolute goodwatch.app URLs). Today the manifest on `static.goodwatch.app` sets both to `/`, which resolves to the static host. It unlocks the Microsoft Store and PWA directories, but brings few visitors on its own.

## Recommended moves

Ranked by value per owner hour. Hours are estimates.

| Rank | Move | Owner hours | Link type | Why it ranks here |
| --- | --- | --- | --- | --- |
| 1 | **Check the passive mirrors once the official listings are public:** Claude Market and Node8 | 0.1 | Followed (Claude Market), nofollow (Node8) | No work. Both copy the official Claude and ChatGPT directories, and both have Entertainment categories. Don't pay Claude Market or add its badge |
| 2 | **Suggest GoodWatch to European Alternatives and Go European** as an alternative to IMDb, Rotten Tomatoes, and Letterboxd | 0.75 for both | Followed (checked) | The only free, reviewed, followed listings in this channel. Domain quality is modest (Tranco 151,898 and not ranked). Decide the EU framing first |
| 3 | **List on WebCatalog** | 0.3 | Nofollow (checked) | Free, reviewed, indexed pages next to Letterboxd and JustWatch. Visitors only |
| 4 | **Open one FMHY issue** pitching only what is distinct: the combined IMDb, Rotten Tomatoes, and Metacritic score, and the episode rating grid | 0.5 | Followed (checked) | The strongest domain with a fitting audience (Tranco 33,335). Staff reject plain TMDB front ends, so lead with the parts others lack. Only if you accept the piracy-index association |
| 5 | **Suggest goodwatch.app to Curlie's Arts > Movies > Databases** once the site responds | 0.25 | Followed (archived page) | The best topical category in this channel. Editors are slow, so it may take months or never. Suggest one category only, since Curlie treats more as spam |
| 6 | **After the data study is public, send one note each to the UC Santa Barbara, Penn, University of Oregon, and Hood College library guides** | 1.5 for four | Followed (checked), on .edu and libguides.com domains | Strong domains and the right page type, but low odds per note. The UCSB page's own remark that JustWatch is US-focused is the honest hook. Check each page's robots meta first |
| 7 | **Suggest the blog to ooh.directory and Feedle** once 2 or more posts are in the feed | 0.2 | Followed (ooh.directory) | Minutes each, and ooh.directory has a Movies category. Blocked until `/blog/rss.xml` has items |
| 8 | **Send a German angle from the passport study to Caschys Blog's tip form**, and pitch WEB.DE Magazin for a new film-finder piece | 0.75 | Followed in editorial bodies (checked) | Large German audiences (Tranco 40,152 and 2,449). Needs a story, not a listing, and the English-only UI lowers the odds. Coordinate with the channel 05 pitch plan |

Lower value, do only if time allows: a Trakt forum post about importing Trakt exports, and a Plex Dev API Corner write-up about the Plex connect flow (1 to 2 h each, `nofollow ugc`, visitors only). Recheck Store.app's terms (followed link seen) when its "Get Listed" page loads.

## Skip list

| Item | Reason |
| --- | --- |
| Toolify, Easy With AI, AI Agents List, OpenTools, FindMyAITool, AI Agents Listing, AItoolnet, euacc.ai | Sell followed links |
| Dang.ai, Toolpilot, German Webkataloge | Require a reciprocal link |
| TopAI.tools, AI Agents Directory, AI Agent Store, AIxploria | Nofollow, B2B or AI-builder audience |
| AI Tools Directory (aitoolsdirectory.com) | Rejects non-AI products; its redirect host blocks Googlebot |
| EveryDev.ai, Claude Marketplaces, SkillsLLM | Developer audience, or links go to GitHub. Revisit only if a public Claude plugin repo exists |
| GPTStore.ai, GPTs Works, GPTs Hunter, Ben's Bites directory, AI Tool Hunt, SaaS AI Tools, AI Directories, aitools.fyi, Insidr, AI Valley, agent.ai, awesome-chatgpt-apps | Dead, pivoted, custom GPTs only, mass-submission funnels, or too small and stale |
| Appscope, FindPWA, pwastore.dev, Insanely Cool Tools | Dead or parked |
| PWAStore | GoodWatch doesn't meet its PWA bar, and it lists an adult video downloader on its home page |
| Kagi Small Web, Kagi bangs, DuckDuckGo bangs, Wiby, searchmysite, Marginalia | Personal or classic-web sites only, startups excluded, paid, or nothing to submit |
| Cool Tools (kk.org), Recomendo | Reviews come from long-term users or the editors, not makers |
| awesome-useful-websites | Maintainer inactive since 2026-05; GitHub links are nofollow |
| One Page Love, Minimal Gallery, Land-book, Godly, Lapa Ninja, Sidebar, Awwwards, CSS Design Awards, Tool Finder | Design audience, one-page sites only, or paid |
| Jasmine Directory, Best of the Web, bulk "submit your site" directories, similar-site generators | Paid or automated directories, which Google names as link spam |
| Are.na, Ye Olde Blogroll | User-generated, or personal blogs only |
| Trakt apps page | Removed (404 since the move to app.trakt.tv) |
| Letterboxd API apps | No public app list; its API page excludes recommendation, data-visualization, and LLM projects |
| Simkl apps, MDBList integrations, Jellyfin clients, awesome-jellyfin, Plexopedia | Need an integration GoodWatch doesn't have, or the list doesn't exist. Simkl becomes a fit if GoodWatch adds a Simkl import |
| Penn German film guide | `noindex,nofollow` page |
| AFTRS, Louisburg College, Chippewa Valley Technical College, UC Berkeley, Mt. San Antonio College library pages | Short, static lists or one-tool answers |
| Grounded Reason, CordCutting.com | No tools directory; editorial pitches only |
| Subreddit wikis | `nofollow ugc`; content not verified (Reddit blocked scripted fetches) |
| Startbase, Gründerszene database, Gründerküche, StartupBrett, EU-Startups, Startup Europe, Berlin Startup Map, Trending Topics | Website link hidden behind a login, gone, neglected, or investor audience |
| webwiki.de | Casino link on the home page and a paid seal |
| PC-WELT | Tool links are `href="#" rel="nofollow"` with the URL in JavaScript |
| netzwelt.de | JustWatch is its data partner; IMDb and TMDB links are nofollow |
| chip.de, computerbild.de download catalogues | Installable software only |
| werstreamt.es, EuroStack | Competitor; policy site with no listings |

## Sources

All accessed 2026-10-21. Link types were read from live server HTML with curl unless the CSV says "archived" or "(not verified)".

- Tranco list 262W9: https://tranco-list.eu/top-1m.csv.zip
- Google link spam policy: https://developers.google.com/search/docs/essentials/spam-policies#link-spam
- AI directories: https://claudemarket.ai/submit, https://claudemarket.ai/connectors/category/entertainment, https://node8.ai/ai-connectors/chatgpt/, https://node8.ai/ai-connectors/entertainment/achriom/, https://chatgptappsrank.com/submit-app, https://futuretools.io/submit-a-tool, https://futuretools.io/robots.txt, https://supertools.therundown.ai/submit, https://www.rundown.ai/tools/agentcard, https://a2ui.me/apps/movie-context-provider-mcp-apps/, https://www.everydev.ai/topics/mcp-apps-directories, https://aiagentslisting.com/submit, https://aiagentsdirectory.com/agent/betapick, https://aiagentslist.com/submit, https://www.aiagentstore.ai/ai-agent/adal, https://www.toolify.ai/submit, https://saascity.io/directories/toolify (third party), https://topai.tools/t/adobe-firefly, https://www.dang.ai/submit, https://www.toolpilot.ai/pages/submit-your-ai-tool, https://www.easywithai.com/submit-tool/, https://opentools.ai/friends/launch-tool, https://aitoolsdirectory.com/submit, https://link.aitoolsdirectory.com/robots.txt, https://www.aitoolnet.com/submit, https://www.aixploria.com/en/add-ai/, https://aivalley.ai/submit-tool/, https://findmyaitool.com/submit-tool, https://claude.com/marketplace/connectors/goodwatch (404)
- Web app and curated directories: https://webcatalog.io/en/developers/app-listing, https://webcatalog.io/en/apps/letterboxd, https://webcatalog.io/en/apps/justwatch, https://curlie.org/docs/en/help/submit.html, https://web.archive.org/web/20210916112353id_/https://curlie.org/en/Arts/Movies/Databases, https://store.app/duolingo-com, https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/, https://www.pwastore.io/guidelines, https://ooh.directory/suggest/, https://ooh.directory/blogs/arts/movies/, https://feedle.world/faq, https://webcurios.co.uk/webcurios-16-10-26/, https://kk.org/cooltools/submit-a-tool/, https://onepagelove.com/submit, https://minimal.gallery/submit/, https://www.cssdesignawards.com/submit, https://toolfinder.com/submit, https://wiby.me/about/guide.html, https://searchmysite.net/admin/add/, README files of the kagisearch/smallweb and kagisearch/bangs repositories (via `gh api`)
- GoodWatch: https://static.goodwatch.app/site.webmanifest, https://goodwatch.app/sw.js (404), https://goodwatch.app/blog/rss.xml (no items)
- Movie and TV resources: https://fmhy.net/video, https://fmhy.net/other/contributing, issue 4993 in the FMHY edit repository (via `gh api`), https://forums.trakt.tv/c/3rd-party/other/16, Wayback capture 20260617092901 of https://trakt.tv/apps, https://letterboxd.com/api-beta/ (search summary; the page returns 403 to scripts), https://simkl.com/apps/, https://docs.mdblist.com/, https://forums.plex.tv/c/dev-community/dev-api-corner/61, https://jellyfin.org/downloads/clients/, the awesome-jellyfin README (via `gh api`), https://guides.library.upenn.edu/cims, https://guides.library.upenn.edu/streamingfaq, https://guides.library.upenn.edu/grmn/film, https://guides.library.harvard.edu/UsingVideo/FindStreaming, https://guides.library.ucsb.edu/video/streaming-other, https://researchguides.uoregon.edu/find-videos-films/video_search_engines, https://hood.libguides.com/film/web, https://butte.libguides.com/film, https://libguides.aftrs.edu.au/Film, https://louisburg.libguides.com/Film, https://libguides.cvtc.edu/streaming, https://guides.lib.berkeley.edu/societies-cultures/globalfilms, https://mtsac.libanswers.com/faq/346438, https://www.groundedreason.com/, https://cordcutting.com/
- German and EU directories: https://european-alternatives.eu/product/qwant, https://european-alternatives.eu/about, https://www.goeuropean.org/submit-an-alternative, https://www.goeuropean.org/eu-products/lignina, https://only-eu.eu/kategorien/streaming/mubi, https://switching.software/use/librivox/, the CONTRIBUTING.md of the swiso/website repository on Codeberg, https://www.euacc.ai/list-your-startup, https://www.startbase.de/organization/startupbrett/, https://www.gruenderszene.de/datenbank (redirect), https://www.gruenderkueche.de/startup-guide-eintrag/, https://www.webwiki.de/eintragen, https://stadt-bremerhaven.de/tipp-senden/, https://web.de/magazine/digital/streaming-websites-apps-richtigen-film-36863946, https://www.pcwelt.de/article/1361235/diese-webseiten-sollte-wirklich-jeder-kennen.html, https://www.netzwelt.de/serien/star-trek-strange-new-worlds/, https://www.deutsche-startups.de/kontakt/kontakt/, https://www.basicthinking.de/blog/about/, https://euro-stack.info/, ipinfo.io for 159.69.247.66 (goodwatch.app)

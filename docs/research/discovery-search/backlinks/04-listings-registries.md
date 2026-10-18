# Backlinks family 4: listing pages, best-of lists, registries, credit pages

Researched 2026-10-18. Research only: nothing was posted, submitted, or sent.

How link types were checked: unless noted, I downloaded the page HTML with curl and read the `rel` attribute on the outbound `<a>` tag. "Dofollow" here means the editorial link had no `nofollow`, `ugc`, or `sponsored` value. Anything marked "(not verified)" could not be confirmed against a primary source or page HTML. Traffic estimates are my judgment, not measured numbers.

## Read this first: a TMDB terms issue that affects every MCP listing

GoodWatch's MCP server and its title analysis both use TMDB content. The TMDB API terms (last updated 2023-10-20) say:

- Section 1.C, a prohibited use under the free non-commercial license: "Use the TMDB APIs or TMDB Content in connection with, including for training, a machine learning (ML) or artificial intelligence (AI) based Application."
- Section 2.A lists as commercial use (needs a written agreement with TMDB): "Using TMDB, the TMDB APIs, or TMDB Content on or in connection with a "destination" website, search engine, or interactive query-response system (including large language model (LLM), artificial intelligence, or any other machine learning based interactive query-response systems or chatbots)".
- Commercial use "without such a written agreement constitutes a material breach."

The directories in section 4 exist to make the MCP server more visible. The Claude portal asks whether your data is first-party, proxied with permission, or a third party's. OpenAI's guidelines say "We cannot approve plugins that primarily function as unofficial connectors to third-party services" and forbid integrating "with third-party APIs without proper authorization". Before promoting the MCP server in big directories, the owner should decide how GoodWatch stands under these TMDB clauses. One option is to ask TMDB directly. This is not legal advice, and I did not check whether GoodWatch already has an agreement with TMDB.

Sources: https://www.themoviedb.org/api-terms-of-use (accessed 2026-10-18), https://developers.openai.com/apps-sdk/app-submission-guidelines (accessed 2026-10-18), https://claude.com/docs/connectors/building/submission (accessed 2026-10-18).

## Prior work in the repo (don't redo it)

- `docs/implementation/mcp-directory-listing.md` is a complete Claude Connectors Directory submission kit: copy, reviewer account, screenshot prompts, and annotation audit. Nothing has been submitted yet.
- `docs/implementation/mcp-compatibility-registry.md` and `goodwatch-webapp/server.json` (on origin/main) hold a validated Official MCP Registry manifest, `app.goodwatch/mcp`, plus a DNS-proof recipe. It is not published yet. I confirmed on 2026-10-18 that a registry search for `app.goodwatch/mcp` returns 0 results.
- `origin/research/mcp-distribution:docs/implementation/mcp-distribution-research.md` covers client setup and directory submission mechanics.

What this file adds: what each listing is worth as a link, the editorial "best of" channel, Wikipedia, awesome lists, credit pages, and open-source ideas.

## 1. "Best movie recommendation sites" articles

### What exists

| Article | Publisher type | Published / updated | Lists tools like GoodWatch? | Tool link type (checked) |
|---|---|---|---|---|
| [The 9 Best Sites to Find Which TV Show to Watch Next](https://www.makeuseof.com/tag/sites-find-tv-show-watch-next/) | MakeUseOf (Valnet) | 2017-09-30, modified 2024-09-04 | Yes (Reelgood, Flixable, Taste.io) | Dofollow |
| [5 Fun and Quirky Movie Recommendation Sites](https://www.makeuseof.com/fun-movie-recommendation-sites-discover-films-to-watch-next/) | MakeUseOf | 2023-07-06 | Yes (moveme.tv, nextflick.io, small indie sites) | Dofollow |
| [5 New Recommendation Sites for Movies You Would Hate to Miss](https://www.makeuseof.com/recommendation-sites-for-movies-you-would-hate-to-miss/) | MakeUseOf | 2021-06-26 | Yes (small indie sites) | Dofollow |
| [6 Unique Ways to Find Film and TV Show Recommendations](https://www.makeuseof.com/unique-ways-to-find-film-and-tv-show-recommendations/) | MakeUseOf | 2020-08-22 | Yes (cinetrii, whattowatchon.tv) | Dofollow |
| [5 Film Recommendation Sites](https://www.makeuseof.com/tag/film-recommendation-sites/) | MakeUseOf | 2018-08-28 | Yes | Dofollow |
| [The 7 Best Apps to Find What Movie to Watch Next](https://www.makeuseof.com/movie-recommendation-apps-android-iphone/) | MakeUseOf | 2022-05-19 | Apps only | App Store links dofollow, Play links affiliate `sponsored nofollow` |
| [I quit using streaming service recommendations after discovering 3 movie-finding tools](https://www.howtogeek.com/i-quit-using-streaming-service-recommendations-after-discovering-movie-finding-tools/) | How-To Geek (Valnet) | 2026-06-13 | Yes (Letterboxd, JustWatch, TasteDive) | **Nofollow** |
| [The Best Ways to Find Something New to Watch](https://www.howtogeek.com/25773/the-best-ways-to-find-something-new-to-watch/) | How-To Geek | 2019-11-16, modified 2022-06-13 | Yes (JustWatch, Date Night Movies) | Dofollow |
| [I watch a lot of TV shows and this app helps me keep track](https://www.tomsguide.com/features/i-watch-a-lot-of-tv-shows-and-this-app-helps-me-keep-track-of-everything-im-streaming) | Tom's Guide (Future) | 2024-01-01 | One app (Marathon) | **Nofollow** |
| [8 Best Letterboxd Alternatives](https://www.documentarytube.com/blog/8-best-letterboxd-alternatives-in-2026-apps-like-letterboxd/) | Small niche blog | 2026-09-23 | Yes (Trakt, Criticker, Simkl, Flickchart) | Dofollow (Amazon links sponsored) |
| [Best TV Show Tracker Apps in 2026](https://moviebase.app/resources/best-tv-show-tracker-apps-2026) | Competitor app blog (Moviebase) | 2026-03-28, modified 2026-09-13 | Trackers only | Dofollow to rivals |
| [Best TV Show Tracker Apps in 2026, Compared After TV Time](https://tvtrack.io/best-tv-show-tracker) | Competitor app blog (TV Track) | 2026-07-08, modified 2026-08-11 | Trackers only | Nofollow |
| [Best Movie Tracking Apps (2026)](https://www.achriom.com/blog/best-movie-tracking-apps/) | Competitor app blog (Achriom) | 2026-01-24, modified 2026-10-12 | Trackers | No outbound tool links found in HTML |
| [The 7 best TV show tracker apps in 2026, ranked honestly](https://hobiapp.com/blog/best-tv-show-tracker-apps) | Competitor app blog (Hobi) | 2026-07-10, modified 2026-08-01 | Trackers | No outbound tool links found in HTML |

Observations:

- I found no current Lifehacker, Zapier, or PCMag roundup for this niche. Lifehacker could not be searched from this tool (domain blocked), so that gap is "(not verified)".
- MakeUseOf runs this format most often. Its 2020 to 2023 pieces link small, unknown sites with dofollow links. The newer How-To Geek and Tom's Guide pieces I checked use nofollow. Link type varies by article and year, so assume nofollow on new Valnet and Future pieces until you see the HTML.
- Most 2026 "best tracker" roundups are written by competing apps (Moviebase, Achriom, Hobi, TV Track, Tasteray). They rarely add rivals on request, and Tasteray's article pages look like SEO content farms. Low value.
- The big outlets rarely refresh old roundups. Most were published once (the dateModified equals datePublished). The realistic path is a new first-person article ("I found a site that shows IMDb, RT, and Metacritic scores together"), not getting added to an old one.
- Name collision: an iOS kids app is also called "GoodWatch - Original Shows" (https://appgoblin.info/apps/6761436542, accessed 2026-10-18). Writers searching the name may land on it. Pitches should say "goodwatch.app".

### How tools get included

- MakeUseOf's contact page has an "Editorial Inquiries: Topic Ideas, Feedback, Corrections or Suggestions" route (https://www.makeuseof.com/contact/, accessed 2026-10-18). No "suggest a tool" form was found on MakeUseOf, How-To Geek, or Tom's Guide.
- Writers of the "5 quirky sites" style often find tools on Reddit, Product Hunt, and AlternativeTo (not verified, inferred from the kinds of sites they list).
- Crowdsourced directories feed the writers:
  - AlternativeTo: free; sign up, then "Suggest new application" and review (https://alternativeto.net/faq, accessed 2026-10-18 via search snippet). Listings show an "Official Website" link (checked on the Flickmetrix page). Link rel is "(not verified)" because the site returned HTTP 403 to curl.
  - SaaSHub: the visit button on the Flickmetrix page is `rel="nofollow"` (checked).
  - Slant ("25 Best movie recommendation websites", https://www.slant.co/topics/782/~best-movie-recommendation-websites): user-added options, last updated 2023 per search snippet (not verified; the page returned HTTP 526).

### Polite, honest outreach approach (for the owner, not done)

1. First make the site worth listing. A clear one-line pitch: "IMDb, Rotten Tomatoes, and Metacritic scores side by side, streaming availability for your country, and you can use it from ChatGPT or Claude." Make sure the home page shows this in five seconds.
2. List GoodWatch on AlternativeTo as an alternative to Flickmetrix, JustWatch, and Reelgood. Use honest tags. Don't post self-reviews or upvote yourself.
3. Pick 3 to 5 writers who wrote a relevant piece in the last 12 months. Send one short note through the outlet's editorial route: who you are (solo developer), what is different, one link, no request for a link or dofollow, no follow-up chain. One follow-up after two weeks at most.
4. Offer something useful to the writer, not to SEO: a working account for testing, honest answers about data sources (TMDB, JustWatch via TMDB), and a note that it is free with no ads (only if true).
5. Never pay for placement, never offer a link exchange, never ask for dofollow.

| Item | Value |
|---|---|
| Effort | AlternativeTo: about 30 min. Each pitch: 20 to 30 min including reading the writer's recent work |
| Risk | Low if honest and rare. Mass pitching gets you ignored and can get your domain flagged in writers' inboxes |
| Link value | MakeUseOf older pieces: dofollow (checked). Newer HTG and Tom's Guide: nofollow (checked). AlternativeTo: not verified |
| Expected referral traffic | Low to medium per article if included (judgment). Inclusion odds are low per pitch |
| Prerequisites | Clear home page pitch, stable site, privacy page (exists) |
| Do | Target recent pieces, personalize, accept a no |
| Don't | Pay listicle farms, write fake "best of" posts on other domains, swap links with competitor blogs |

Sources (all accessed 2026-10-18): the article URLs in the table above; https://www.makeuseof.com/contact/; https://alternativeto.net/software/flickmetrix/about/; https://www.saashub.com/flickmetrix.

## 2. Wikipedia

Rules:

- WP:COI: "COI editors are strongly discouraged from editing affected articles directly." They "can propose changes on article talk pages instead" with the `{{edit COI}}` template. Paid editors must disclose. (https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest)
- WP:EL: "you should avoid linking to a site that you own, maintain, or represent." It also says "Google and other search engines ignore links on Wikipedia." (https://en.wikipedia.org/wiki/Wikipedia:External_links)
- WP:SPAM: "Adding external links to an article or user page for the purpose of promoting a website or a product is not allowed." Also "Wikipedia uses nofollow on all external links". Repeat offenders get warnings, blocks, and can be put on the Wikimedia-wide spam blacklist. (https://en.wikipedia.org/wiki/Wikipedia:Spam)
- WP:WEB notability needs "multiple non-trivial published works whose source is independent of the site itself" or "a well-known and independent award". GoodWatch does not meet this today. (https://en.wikipedia.org/wiki/Wikipedia:Notability_(web))
- Link type checked: on the Inception article, the Rotten Tomatoes link is `rel="mw:ExtLink nofollow"`.

Wikidata: external ID links are also nofollow (checked: the Letterboxd ID link on Q25188 is `rel="nofollow"`). A "GoodWatch title ID" property would need a community proposal (https://www.wikidata.org/wiki/Wikidata:Property_proposal). It would be a COI proposal for a small site, and acceptance is unlikely (not verified).

Why it's not appropriate: GoodWatch has no independent coverage. The owner has a COI. The links pass no ranking signal. A spam blacklist entry would follow the domain across all Wikimedia sites.

| Item | Value |
|---|---|
| Effort | n/a |
| Risk | High (blacklist, reputation) for little gain |
| Link value | Nofollow (checked) |
| Expected referral traffic | Near zero for a link in a list article, and it would be removed |
| Do | Nothing now. If independent press coverage appears later, other editors may write about it |
| Don't | Add goodwatch.app to film articles, "List of" articles, or the TMDB / JustWatch articles |

Sources: the four en.wikipedia.org policy pages above, https://en.wikipedia.org/wiki/Inception, https://www.wikidata.org/wiki/Q25188 (all accessed 2026-10-18).

## 3. GitHub awesome lists

General: links in rendered GitHub READMEs are nofollow. I checked the awesome-remix list on GitHub, where `https://utiliti.dev` and `https://metronome.sh` both render as `rel="nofollow"`. So awesome lists bring developer referral traffic and discovery by MCP aggregators. They bring no ranking signal.

| List | Stars (2026-10-18) | Fit for GoodWatch | Rules (from CONTRIBUTING) |
|---|---|---|---|
| awesome-mcp-servers (the large list, about 96k stars) | 96,557 | **No.** Scope is "servers with a public GitHub repository, something you install and run yourself". Remote-only servers go to the remote list | PR to README, alphabetical, one line, link to repo. CI workflow `check-glama.yml` runs on PRs |
| awesome-remote-mcp-servers (same maintainer) | 1,458 | **Yes.** Has a Multimedia section. A direct competitor, QQuickpick ("Search movies and TV shows by mood, genre and score, filtered to what streams in your country"), is already listed there, and so is SceneF (showtimes) | Endpoint must answer MCP `initialize` (CI checks). "Be usable by anyone. Public sign-up is fine." Must be listed as a Glama connector, with the badge required. Name links to homepage (not repo). Auth marker 🔐 for OAuth. One sentence of up to 120 chars. **The PR author must have starred the repo.** Recent PRs merge within about a day: 44 of the last 50 closed PRs were merged, and 100+ PRs are open |
| awesome-mcp-servers (the list behind mcpservers.org) | 4,369 | Via website only | "We do not accept PRs. Please submit your MCP on the website: https://mcpservers.org/submit" (see section 4) |
| awesome-mcp-servers (an archived copy) | 5,795 | No | Archived (read-only) |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 91,350 | No | Reference servers only. README sends people to the MCP Registry. "We accept issues, not pull requests." |
| [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) | 327,945 | **No** | Free/open-source software that you host yourself, first release over 4 months old, submitted via the awesome-selfhosted-data repo. GoodWatch is a hosted service, not a self-hostable product. Its CONTRIBUTING also asks that entries be written and submitted by a human, not an AI agent |
| awesome-remix | 452 | Weak. Has an "Example Apps" section, mostly open-source repos. The GoodWatch repo is MIT and public, so it would technically qualify | No CONTRIBUTING found. Last push 2026-04-25. Value is small |
| Movie-themed awesome lists | All under 20 stars (GitHub search for "awesome movies" in names) | No | Not worth it |
| awesome-claude-connectors | 140 | Mirrors Anthropic's catalog | Would pick up GoodWatch automatically if it gets into the Claude directory (not verified) |

| Item | Value |
|---|---|
| Effort | Remote list: 30 min after the Glama connector exists |
| Risk | Low. It is a factual one-line entry |
| Link value | Nofollow (checked on GitHub rendering) |
| Expected referral traffic | Low, developer audience. Mostly indirect: aggregator crawlers and people building MCP clients (judgment) |
| Prerequisites | Glama connector listing (section 4), endpoint answers `initialize` publicly |
| Do | Describe what the tools do in plain words, use the correct 🔐 marker |
| Don't | Submit to the installable-servers list or awesome-selfhosted. Don't use the "🤖🤖🤖 agent fast-track" path the CONTRIBUTING mentions: the owner should open the PR personally |

Sources (all accessed 2026-10-18): the CONTRIBUTING.md and README.md of each repo above, read via `gh api`; the awesome-remix README page (HTML for the rel check). Repository URLs are left out because they contain personal account names; search GitHub for the list names.

## 4. MCP registries and directories

| Directory | Free? | Requirements | Link to goodwatch.app, and type | Notes |
|---|---|---|---|---|
| [Official MCP Registry](https://registry.modelcontextprotocol.io) | No fee stated in the docs (a free guarantee is not stated either) | Public remote URL ("A remote server MUST be publicly accessible"), `server.json`, namespace proof via DNS TXT or `/.well-known/mcp-registry-auth`, `mcp-publisher publish`. Supports closed-source servers. Still "in preview", so data resets are possible | JSON API, not an HTML page, so no backlink. `websiteUrl` field is consumed by aggregators | Moderation only removes illegal content, malware, spam, and broken servers. Movie MCP servers already in it: goodrecmovies.com, untitled.movie, movie.penguindriver.com. Manifest is ready in the repo |
| [PulseMCP](https://www.pulsemcp.com) | n/a | "Submissions and changes are temporarily paused" (updated 2026-09-03). It says to publish to the Official MCP Registry: "we will pick it up automatically once we are back" | **Dofollow** to the marketing URL (checked on /servers/achriom: `rel="noopener"` only) | Best link of the MCP directories. It also has movie-adjacent listings: Achriom, TMDB servers |
| [Glama connectors](https://glama.ai/mcp/connectors) | Not stated in FAQ | HTTPS, streamable-http, name, description, optional private test credentials. Syncs from registry. Claim ownership via `_glama-claim.<domain>` TXT or `/.well-known/glama.json` | **Nofollow** (checked on Pixly listing: `rel="noopener noreferrer nofollow"`) | Required for the awesome-remote list badge. Scores tool quality (TDQS) |
| [mcpservers.org](https://mcpservers.org/submit) | Free (review within 2 weeks); $39 premium | Name, category, short description, website/docs URL, optional registry name, remote checkbox, contact email | Free listings: **nofollow** (checked on a remote listing). The $39 tier is sold as "Dofollow link (DR 71)" | Buying that dofollow link is a paid link for ranking, which breaks Google's spam policy ("Buying or selling links for ranking purposes"). Use the free tier only |
| [mcp.so](https://mcp.so/submit) | Form shows only a $39 paid path, which advertises a "Dofollow project link" | Repo URL, name | Free link type not verified | Some people file free submission issues in the mcp.so GitHub repository (5,000+ issues, active today). Whether these get processed is not verified. Skip the paid path for the same Google policy reason |
| [MCP Market](https://mcpmarket.com/submit) | Free queue (4 to 6 weeks) or $29 | GitHub repo or "Remote MCP" | Free tier: "No 'Try Now' link to your site". So the free listing may not link to the site at all | Low value on the free tier |
| [Smithery](https://smithery.ai/new) | Pricing not established | Public HTTPS, streamable HTTP, OAuth supported. "Smithery Gateway proxies to your upstream server." Return 401 (not 403) to unauthenticated scans; allowlist `SmitheryBot/1.0` | Not checked (sign-in wall) | Proxying means member traffic goes through a third party. Check its data terms before listing |
| [Cline MCP Marketplace](https://github.com/cline/mcp-marketplace) | Free | GitHub issue with a repo URL, a 400×400 logo, and a test where Cline installs from the README. Vetting looks at "Community Adoption" and "Developer Credibility" | In-app, not a web link | Built around cloning installable repos. Last push 2025-06-24. Poor fit for a hosted OAuth server |
| Cursor directory (cursor.directory) | Not verified | Not verified (Vercel bot check returned HTTP 429) | Not verified | Coding audience. Low fit for a movie app |
| [Claude Connectors Directory](https://claude.com/docs/connectors/building/submission) | No listing fee stated. Submitter needs a Pro, Max, Team, or Enterprise plan ("Free accounts can't submit") | Remote HTTPS. OAuth 2.0 for user data. Every tool needs a `title` and `readOnlyHint` or `destructiveHint`. Docs URL, privacy URL, support contact, icon, reviewer test account. MCP Apps need 3 to 5 PNG carousel screenshots. Seven compliance acknowledgments, including "first-party API usage" and a data-handling question about third-party APIs. Default outcome: automated scan, then listed as a "Community" connector | Public pages exist at claude.com/marketplace/connectors/<slug>. On the Notion page, the company website link has `rel="noopener noreferrer"` (**dofollow**). The claude.com robots.txt allows all crawlers. Whether Community connectors get the same public page is not verified | Kit ready in the repo. Highest-value MCP listing for real member traffic: people browse it inside Claude. The TMDB issue above applies |
| [ChatGPT plugin directory (formerly the apps directory)](https://developers.openai.com/apps-sdk/deploy/submission) | No fee stated (not verified) | Verified individual or business, domain challenge token, four listing URLs (website, support, privacy, **terms**), exactly 5 positive and 3 negative test cases, a video walkthrough, and a test account with no MFA. No ads; commerce only for physical goods. "Only use intellectual property that you own or have permission to use." | Public pages at chatgpt.com/plugins/<id>. On Adobe's page, the website link has `rel="noopener noreferrer"` (**dofollow**). The chatgpt.com robots.txt allows `/plugins` | GoodWatch has no /terms page yet (per the repo kit). Stricter rule on third-party APIs. Do this after Claude, once the TMDB position is clear |

Overall:

| Item | Value |
|---|---|
| Effort | Registry: 1 to 2 h (DNS TXT plus publish; manifest already done). Glama: 30 min. mcpservers.org free: 15 min. Claude: half a day (screenshots, portal). ChatGPT: 1 to 3 days (terms page, video, test cases) |
| Risk | Low for listings themselves. Medium for the TMDB terms exposure (see top). Paid "dofollow" tiers are a Google link-scheme risk |
| Link value | PulseMCP dofollow (checked). Claude marketplace and ChatGPT plugin pages dofollow on the examples checked. Glama, mcpservers.org, GitHub: nofollow. Registry: none (API) |
| Expected referral traffic | Claude and ChatGPT directories: the only ones here with consumer reach (judgment, no numbers available). Developer directories: low |
| Prerequisites | Working OAuth (exists), icon (exists), privacy page (exists), terms page (missing, needed for ChatGPT), TMDB decision |
| Do | Registry first (it feeds PulseMCP, Glama, and others), then Claude, then the free developer directories |
| Don't | Buy "dofollow" tiers, publish duplicate entries under several names (registry spam rule), list third-party domains as owned link URIs |

Sources (all accessed 2026-10-18): https://modelcontextprotocol.io/registry/about, https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx, https://modelcontextprotocol.io/registry/authentication, https://modelcontextprotocol.io/registry/moderation-policy, https://registry.modelcontextprotocol.io/v0/servers?search=movie, https://www.pulsemcp.com/submit, https://www.pulsemcp.com/servers/achriom, https://glama.ai/mcp/faq, https://glama.ai/mcp/connectors/app.pixly/pixly, https://mcpservers.org/submit, https://mcpservers.org/servers/0xcuy/adexto-mcp, https://mcp.so/submit, https://mcpmarket.com/submit, https://smithery.ai/docs/build/publish, https://github.com/cline/mcp-marketplace, https://claude.com/docs/connectors/building/submission, https://claude.com/docs/directory/publish, https://claude.com/marketplace/connectors/notion, https://developers.openai.com/apps-sdk/deploy/submission, https://developers.openai.com/apps-sdk/app-submission-guidelines, https://chatgpt.com/robots.txt, https://developers.google.com/search/docs/essentials/spam-policies.

## 5. Data credit pages and "built with" showcases

| Target | What exists | Can GoodWatch get a link? |
|---|---|---|
| TMDB | Attribution is required: TMDB logo, less prominent than your own, plus the notice "This product uses the TMDB API but is not endorsed or certified by TMDB." The repo already has this notice in the TMDB connect panel. The FAQ mentions no app showcase. The forum (themoviedb.org/talk) has four categories (General, Website, API support, Content errors) and no app showcase section | No showcase. Posting in API support to promote the app would be off-topic. One legitimate use is asking TMDB about the AI/chatbot clauses there or via sales |
| JustWatch (via TMDB) | TMDB's watch-provider endpoint says: "In order to use this data you must attribute the source of the data as JustWatch." Usage that doesn't comply "may lead TMDB to revoke API access" | No link back. JustWatch has a paid partner API and widget (not verified, third-party sources only). Check that GoodWatch shows a JustWatch credit wherever it shows availability |
| OMDb | GoodWatch does not appear to use OMDb in app code (only in docs and prototype files) | n/a |
| Trakt | GoodWatch only imports Trakt export ZIPs (no API client). trakt.tv/apps returns 404 | n/a |
| Wikidata | See section 2 | No |
| Remix showcase (v2.remix.run/showcase) | Page loads with no visible entries and no submission path found. The remix-website repo has no showcase data file | Not available (not verified that it is closed) |
| React Router showcase | reactrouter.com/showcase returns 404 | No |
| Supabase (madewithsupabase.com, community-run) | Has "Submit a project" | Skip: the repo docs show Postgres/Supabase is being retired (docs/postgres-retirement*.md). A "made with" listing would soon be false |
| Qdrant | /customers has case studies only. No open showcase found | Only through a pitched case study or guest post (not verified) |
| Coolify, Windmill, CrateDB, Valkey, Satori, resvg | No showcase pages found (Windmill /customers 404, CrateDB customers page is case studies, Valkey lists project participants, not users; READMEs for satori, qdrant, and coolify have no "used by" section) | No |

| Item | Value |
|---|---|
| Effort | Low (attribution check: 15 min) |
| Risk | Getting attribution wrong is the real risk here (API revocation) |
| Link value | None available today |
| Expected referral traffic | None |
| Do | Keep TMDB and JustWatch attribution visible. Write technical posts on GoodWatch's own domain and share them in vendor communities where that is welcome (other channel family) |
| Don't | Claim "built with Supabase" while retiring it, or post promotional threads in the TMDB API forum |

Sources (all accessed 2026-10-18): https://www.themoviedb.org/api-terms-of-use, https://developer.themoviedb.org/docs/faq, https://www.themoviedb.org/talk, https://developer.themoviedb.org/reference/movie-watch-providers, https://trakt.tv/apps, https://v2.remix.run/showcase/, https://reactrouter.com/showcase, https://www.madewithsupabase.com/, https://qdrant.tech/customers/, https://www.windmill.dev/customers, https://cratedb.com/customers, https://valkey.io/; repo files checked: goodwatch-webapp/package.json, goodwatch-webapp/app/ui/imports/TmdbConnectPanel.tsx, goodwatch-webapp/app/domain/imports.ts.

## 6. Browser extension and app stores

Not relevant now. GoodWatch has no extension or native app. A Chrome or Firefox extension (for example, showing GoodWatch scores on Netflix pages) would earn a store listing with a website link. But it is a new product with ongoing maintenance and store review. The link type of store listings is not verified. Revisit only if there is a product reason.

## 7. Open-source angles (ideas, not plans)

The monorepo is public and MIT licensed (LICENSE, 2023), but it is a full app. Small, reusable pieces could earn links from awesome lists (nofollow) and from developer blogs or newsletters (sometimes dofollow, not verified):

1. **Remix MCP server with OAuth and MCP Apps UI** (app/server/mcp/: Better Auth OAuth with CIMD and DCR, read and write scopes, batch undo, poster-grid UI resource). A minimal template repo "remote MCP server on Remix/React Router with OAuth and an MCP App" fits awesome-remix, MCP newsletters, and r/mcp. Effort: high (2 to 4 days to extract, generalize, and document; it touches auth). Most link potential, because few public examples of remote OAuth MCP plus MCP Apps exist (not verified).
2. **Satori + resvg OG card renderer in a child process** (app/server/card-renderer/render.child.js). A small library or blog post on "render OG images with satori and resvg without crashing the server". Effort: medium (1 to 2 days). Modest interest.
3. **Ratings dataset**: likely not allowed. IMDb datasets are non-commercial and redistribution terms are not verified. TMDB content can't be redistributed outside its terms, and caching is capped at 6 months. Don't publish.
4. **Write-ups instead of code**: posts on GoodWatch's own domain (for example, "how we score taste matches", "what we learned listing an MCP server") earn links to goodwatch.app itself rather than to GitHub. Effort: half a day each. This fits better than repos if the goal is links to the site.

Risk is low for all of these. The cost is maintenance: an abandoned template repo reflects badly.

## Summary table

| Target | Effort | Risk | Link value | Expected traffic | Prerequisites | Fit |
|---|---|---|---|---|---|---|
| Official MCP Registry | 1 to 2 h | Low | None (API), feeds others | Indirect | DNS TXT, manifest (ready) | High |
| PulseMCP (via registry) | 0 after registry | Low | Dofollow (checked) | Low | Registry entry, wait for reopening | High |
| Claude Connectors Directory | Half a day | Medium (TMDB terms) | Dofollow on marketplace page (checked on Notion; Community pages not verified) | Highest in this family (judgment) | Paid Claude plan, screenshots, kit (ready), TMDB decision | High |
| ChatGPT plugin directory | 1 to 3 days | Medium to high (TMDB, third-party API rule) | Dofollow on plugin page (checked on Adobe) | High if approved (judgment) | Terms page, verification, video, test cases | Medium, later |
| Glama connector | 30 min | Low | Nofollow | Low | Registry or manual add | Medium (needed for awesome list) |
| awesome-remote-mcp-servers | 30 min | Low | Nofollow | Low | Glama badge, star repo | Medium |
| mcpservers.org (free) | 15 min | Low | Nofollow | Low | None | Medium |
| mcp.so / MCP Market paid tiers | n/a | Google link-scheme risk | Paid dofollow | Low | Money | Don't |
| Smithery | 1 h | Low to medium (proxy) | Not verified | Low | Check data terms | Low |
| Cline, Cursor directories | n/a | Low | In-app / not verified | Very low | Installable repo | Low |
| AlternativeTo listing | 30 min | Low | Not verified | Low to medium | Honest description | High |
| MakeUseOf / HTG editorial pitch | 20 to 30 min each | Low if rare | Old MUO pieces dofollow; new HTG/Tom's Guide nofollow (checked) | Low to medium if included | Clear home page pitch | Medium |
| Competitor-run roundups | n/a | Low | Mixed | Very low | n/a | Low |
| Wikipedia / Wikidata | n/a | High | Nofollow (checked) | ~0 | Independent coverage | Don't |
| awesome-mcp-servers (main), awesome-selfhosted | n/a | n/a | Nofollow | n/a | Installable / self-hostable software | Ineligible |
| TMDB / JustWatch credit pages | 15 min (check attribution) | Attribution compliance | None | None | n/a | Compliance only |
| Tech showcases (Remix, Qdrant, Coolify, etc.) | n/a | Low | None found | None | Open submission path (none found) | Low |
| Open-source MCP template | 2 to 4 days | Low (maintenance) | Nofollow on GitHub, maybe dofollow from blogs (not verified) | Low to medium, developers | Time | Medium |

## Recommended top 4 moves from this family

0. **Before any of these: decide the TMDB position.** The TMDB terms treat LLM and chatbot use as commercial and forbid ML/AI-based use under the free license. Directory listings make the MCP server more visible to exactly the people who enforce such terms.
1. **Publish `app.goodwatch/mcp` to the Official MCP Registry.** The manifest is validated and in the repo; only the DNS TXT proof and `mcp-publisher publish` remain. This one step queues GoodWatch for PulseMCP (a dofollow listing, checked) when it reopens, syncs to Glama, and feeds other aggregators. Low effort, low risk.
2. **Submit to the Claude Connectors Directory using the existing kit.** It is the only directory here with real consumer browsing, plus a public claude.com marketplace page whose website link was dofollow on the example checked. Needs real screenshots and the owner's paid account. Do ChatGPT later, after a /terms page exists.
3. **Add a Glama connector, then one PR to awesome-remote-mcp-servers, and a free mcpservers.org listing.** About an hour in total, nofollow, but these are where MCP-curious developers and list builders look. A direct competitor is already in the Multimedia section. Skip every paid "dofollow" tier.
4. **List on AlternativeTo, then pitch 3 to 5 recent writers.** Use an honest, specific angle (all three critic scores side by side, per-country streaming, usable inside ChatGPT and Claude). Send the pitches through editorial contact routes such as MakeUseOf's, and accept that new big-outlet links are often nofollow. Don't touch Wikipedia.

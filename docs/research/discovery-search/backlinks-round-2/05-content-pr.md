# Content and PR hooks for GoodWatch, round 2

Scope: this file goes deeper than round 1's `backlinks/05-linkable-assets-pr.md` and `backlinks/04-listings-registries.md` on seven content and PR channels: finding the journalists who cover streaming, "best apps" and "alternatives" listicles, podcasts, unlinked-mention reclamation, broken-link building on movie resource pages, Wikipedia, and German and EU media. It does not repeat round 1's data-study idea list, sourcing platforms (Source of Sources, Qwoted, #journorequest), the Cord Cutters News tip route, or the MakeUseOf, How-To Geek, and Tom's Guide articles round 1 graded. Research only: nothing was posted, submitted, or sent. Individual journalist names are kept out of this public file; they are in a private file outside the repo. All sources were read on 2026-10-21 unless a row says otherwise. Traffic and quality numbers are estimates.

## Summary

- **Two news hooks landed this month.** JustWatch launched its own streaming service, JustWatch TV, on 2026-10-20 in 12 markets including Germany, Austria, and Switzerland ([TechCrunch](https://techcrunch.com/2026/10/20/streaming-guide-justwatch-becomes-a-streamer-itself/), [The Verge](https://www.theverge.com/entertainment/1014640/justwatch-tv-plus-free-store-streaming-service-movie-rental)), so the writers who covered it are the best-fit press list for an independent "where is it streaming" guide. Disney+ US prices reached existing subscribers on 2026-10-21 and Netflix Germany added 2 EUR per plan from 2026-09-03; the study's Netflix US rank (50th of 55) and Netflix Germany rank (47th of 55) answer "what do you get for the money".
- **Finding journalists for free works without Muck Rack.** RSS feeds and JSON-LD bylines, Google News RSS search, outlet tip pages, and Bluesky starter packs (one lists Television Critics Association members) gave 28 press candidates in about two hours. Muck Rack blocks scripted reads, so treat it as a manual browser check only.
- **Listicles: few are worth pitching.** Of 33 listicles from 2025 and 2026, about 20 are competitor app blogs written after TV Time shut down. The worthwhile targets are BGR (followed links, publishes new roundups often) and a Make Tech Easier tracker list refreshed on 2026-10-10 that still lists the dead TV Time. No editorial "best Claude connectors or ChatGPT apps for movies" list exists yet.
- **Podcasts: pitch four, not forty.** Dedicated cord-cutting podcasts have mostly stopped. The best fits are the AI Engineering Podcast (open topic form, followed show-note links), Filmspotting SVU (streaming movie picks, listener email), and two German shows that invite guests: Happy Bootstrapping and programmier.bar.
- **Unlinked mentions: almost none exist yet.** Free searches found three third-party pages that mention GoodWatch without linking goodwatch.app: the Glama connector listing, the awesome-jev-projects entry, and an auto-generated Undercode News article. Name collisions to filter: a ham-radio wristwatch firmware called GoodWatch, an iOS kids app "GoodWatch - Original Shows", and the "#goodwatch" hashtag.
- **Broken links: eight dead tools have live, followed links pointing at them.** Graph TV (dead since 2022) is still linked from FlowingData, Laughing Squid, It's Nice That, and The Mary Sue; Can I Stream It from two University of North Carolina library guides updated in September and October 2026; TV Time from Consumer Reports, How-To Geek, and Make Tech Easier. GoodWatch's episode grid and TV Time import make it a fair replacement for each.
- **Wikipedia: don't.** No non-promotional angle survives the self-published-source and self-citation rules until a reliable outlet covers the study. Links there are nofollow anyway.
- **German and EU angle is real.** heise, t3n, DWDL, mobiFlip, inside digital, and iphone-ticker leave editorial links followed; Moviepilot, Serienjunkies, and netzwelt use nofollow. The EU's Geo-blocking Regulation excludes audiovisual services, the Commission's evaluation report was planned for Q3 2026 and is not published yet, and the European Court of Auditors asked for a study on extending the scope by the end of 2026. The study's country gaps are evidence for that debate.

## 1. Journalists who cover streaming

### How to find them for free

| Method | How | Cost | Owner effort | What it gives | Limits |
|---|---|---|---|---|---|
| Outlet RSS feeds plus JSON-LD bylines | Download a streaming outlet's RSS feed, filter titles for price, catalogue, country, JustWatch, Ghibli; fetch each article and read `author.name` from its JSON-LD | Free | 1 hour to set up, 10 minutes per refresh | Name, date, and article URL for every recent story on the beat. Most WordPress feeds carry `dc:creator` directly. | Feeds hold only the last 10 to 50 items. Some sites block scripted reads (Variety and MoneySavingExpert returned a Cloudflare challenge on some pages). |
| Google News RSS search | `https://news.google.com/rss/search?q=<query>+when:30d&hl=en-US&gl=US&ceid=US:en`, for example `"JustWatch" when:7d`, `Netflix catalogue country when:30d`, `"price increase" Disney+ when:14d` | Free | 5 minutes per query | Up to 100 recent items with outlet name. Returned 57 items for a catalogue query today. | Links go through a Google redirect, and there is no byline: fetch the article for the author. Results lean to VPN-affiliate pages for catalogue queries. |
| Google search operators | `intitle:"price increase" Netflix site:theverge.com`, `"JustWatch TV" -site:justwatch.com`, `inurl:author streaming site:techradar.com` | Free | 5 minutes per query | Author archive pages (most outlets have `/author/<slug>`), which list the writer's whole beat | Manual. Google shows about 10 results per page. |
| Author archive pages | From one relevant article, open the writer's author page | Free | 2 minutes per writer | Whether the writer covers streaming every week or once | None |
| Outlet tip and contact pages | Use the outlet's published tip route instead of a personal address | Free | 2 minutes per outlet | The sanctioned route, often a form | Forms are slower than a direct email to a beat writer |
| Muck Rack free profiles | Search the writer's name on muckrack.com in a browser | Free to view | 2 minutes per writer | Beat, outlets, recent articles | Every scripted request returned a Cloudflare challenge (HTTP 403), so this is a manual check only (not verified what a free account shows) |
| Bluesky starter packs and lists | Bluesky's public search API finds packs such as "TCA (Television Critics Association) Members", "TV & Broadcast Starter Pack", and "Film and TV Sphere - non-fluff - + german critics" | Free | 15 minutes | Who is active on the platform and what they post about | Following is outreach-adjacent; read only during research |
| X lists | Lists of TV reporters exist but X search needs a logged-in account (not verified) | Free | 15 minutes | Same as above | Not checked in this session |
| Newsletter writers at outlets | Outlet newsletters (TechCrunch, The Verge, Lowpass) list their writer on the signup page | Free | 5 minutes | Writers who need a weekly "one number" item | Round 1 covered the newsletters themselves |

What the run produced: 28 press candidates across 25 outlets, 21 of them with an article from August to October 2026 on JustWatch's launch, a price rise, or the Ghibli catalogue. They are in the private file `~/goodwatch-private/backlinks-creators/press-candidates.md`, with outlet, beat, article link, contact route, and the study number that fits each one.

### Outlets that cover streaming catalogue, price, and country stories

Link type is from one recent article's live HTML: "followed" means editorial outbound links carry no `nofollow`, `ugc`, or `sponsored`.

| Outlet | Recent relevant story | Tranco rank (estimate of size) | Editorial link type (checked) | Tip or contact route | Fit and expected value |
|---|---|---|---|---|---|
| TechCrunch | JustWatch becomes a streamer, 2026-10-20 | 645 | **nofollow** (link to THR is `noreferrer noopener nofollow`) | [techcrunch.com/got-a-tip](https://techcrunch.com/got-a-tip/) (press-release email and Signal) | High reach, low link value. A mention drives visitors. |
| The Verge | JustWatch now streams, 2026-10-20 | 863 | Followed (justwatch.com and techcrunch.com links have no rel) | [theverge.com/contact](https://www.theverge.com/contact) (tip form) | High. Followed links, consumer audience. |
| TechRadar (Future) | JustWatch launch, 2026-09-16 | 2,386 | Mostly internal links; affiliate links `sponsored` (listicle check below) | [techradar.com/how-to/contact-us](https://www.techradar.com/how-to/contact-us) | Mention value |
| Cord Cutters News | JustWatch launch, 2026-09-15 | 72,699 | Followed (`noopener` to justwatch.tv) | [cordcuttersnews.com/contact-us](https://cordcuttersnews.com/contact-us/) (form) | High fit for US free-with-ads and library numbers |
| TheWrap | JustWatch TV explained, 2026-09-15 | 9,443 | (not verified: only own-network links in the sample) | [thewrap.com/contact](https://www.thewrap.com/contact/) | Medium |
| The Hollywood Reporter (PMC) | JustWatch to launch a service, 2026-09-15 | 2,589 | Network footer links nofollow; editorial (not verified) | [hollywoodreporter.com/contact](https://www.hollywoodreporter.com/contact/) | Low odds for a tool, medium for a data finding |
| Variety (PMC) | Disney+ and Hulu price rise, 2026-09-23 | 2,242 | Followed in the sample (luminatedata.com, no rel) | [variety.com contact page](https://variety.com/static-pages/contact-us/) (news desk role address) | Long shot |
| T3 (Future) | JustWatch arrives in the UK, 2026-09-23 | 27,235 | **sponsored** even on the plain justwatch.tv link | [About T3 and contact](https://www.t3.com/features/about-t3-contact-t3) | Mention value |
| BetaNews | JustWatch launch, 2026-09-22 | 18,183 | **nofollow** | [betanews.com/contact](https://betanews.com/contact/) | Low |
| Tom's Guide (Future) | Disney+ price rise, 2026-09-24 | 4,768 | No outbound tool links in columns (listicle check) | [About Tom's Guide](https://www.tomsguide.com/reference/about-us) | Mention value, big audience |
| Fortune | Streaming prices in 2026, 2026-09-09 | 1,321 | Followed (help.disneyplus.com, apple.com, no rel) | No tip page found (fortune.com/contact returned 404) (not verified) | Medium. Price-per-catalogue angle. |
| CBS News MoneyWatch, Yahoo Tech | Disney+ price rise, 2026-09-23 and 2026-09-24 | 707 (CBS) | (not verified) | (not verified) | Library-card streaming angle |
| What's on Netflix | Netflix library by the numbers 2025, 2026-01-13 | 38,498 | Followed (`noopener` to newonnetflix.info and others) | [whats-on-netflix.com/about](https://www.whats-on-netflix.com/about/) ("New Tips / Corrections / Contact") | High. The closest peer: it publishes per-country Netflix counts every year. |
| Pocket-lint (Valnet) | Password-sharing crackdown in 2026, 2026-08-02 | 17,909 | **nofollow** on editorial links (help.disneyplus.com) | [pocket-lint.com/contact](https://www.pocket-lint.com/contact/) ("Have a News Tip?") | Mention value |
| ScreenCrush | Netflix price rise, 2026-03-27 | 71,384 | Followed (deadline.com, no rel) | [screencrush.com/contact-us](https://screencrush.com/contact-us/) | Medium |
| ADSLZone (ES), Vandal (ES) | Ghibli stays on Netflix, 2026-08-02 and 2026-08-17 | 39,763 (ADSLZone) | (not verified) | (not verified) | Spain leads the top 1,000 (757 titles): a Spanish angle |
| JustWatch press | Press page and quarterly charts | n/a | n/a | [justwatch.com/us/press](https://www.justwatch.com/us/press) | Not a pitch target: it is now a competitor and a data source GoodWatch credits |
| VPN and statistics sites (thebestvpn, Cybernews, Top10VPN, Cloudwards, Comparitech, businesstats, Statista) | Netflix library size by country pages, updated 2026 | 270,272 (thebestvpn) to 491 (Statista) | Cloudwards followed (listicle check); others (not verified) | Contact forms | They cite catalogue counts and would cite a CC BY dataset. Risk: VPN-unblocking context. Treat as passive citations, don't pitch. |

German outlets are in section 7.

### Per-item grading for the press channel

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit | Rules or route |
|---|---|---|---|---|---|---|---|
| Pitch the JustWatch-launch writers (The Verge, Cord Cutters News, What's on Netflix first) | Free | 2 to 3 hours for 5 one-to-one pitches | Followed at these three; nofollow at TechCrunch and BetaNews | Medium if one writes; a news mention brings hundreds of visits for a day or two (estimate) | Low if each pitch is personal and short | High | Outlet tip pages above |
| Price-rise pitches with the study numbers | Free | 1 hour per 3 pitches, timed to the next price news | Mixed | Low to medium | Low | High | As above |
| Passive citations by VPN and statistics sites | Free | None (publish the CSV with the CC BY line, which the draft already has) | Varies | Low | Medium (association with VPN-unblocking content) | Low | n/a |

## 2. "Best apps" and "alternatives" listicles

33 listicles from 2025 and 2026 were checked in live HTML (two Wondershare pages merged into one row). Rank weighs followed-link chance, outlet quality, the odds of adding a new tool, and relevance. "Followed" means tool links carry no `nofollow`, `ugc`, or `sponsored`. No page mentions GoodWatch.

| # | Article | Outlet type | Tranco | Published / modified | Tools listed | Tool link type (checked) | Takes suggestions? | Why this rank |
|---|---|---|---|---|---|---|---|---|
| 1 | [BGR: movie discovery apps to try instead of IMDb](https://www.bgr.com/2236649/movie-discover-apps-try-instead-of-imdb/) | Editorial (Static Media) | 12,177 | 2026-08-16 | Letterboxd, Trakt, Taste.io, Mubi | Followed, to websites (`target=_blank`, no rel; re-checked) | Comments; methodology section | "Instead of IMDb" fits a combined score exactly. BGR repeats this format, so pitch for the next one. |
| 2 | [Make Tech Easier: mobile apps to track TV shows](https://www.maketecheasier.com/mobile-apps-track-tv-shows/) | Editorial | 40,334 | 2019-07-03 / **2026-10-10** | Next Episode, Hobi, TV Time, SeriesGuide, Seen It! | Followed (`noopener`); mostly store links | "Let us know in the comments"; contact page | Refreshed this month and still lists TV Time (heading "3. TVTime", re-checked), which shut down on 2026-07-15. A dead slot to fill. Weak spot: "mobile apps" framing. |
| 3 | [BGR: essential TV streaming apps you haven't heard of](https://www.bgr.com/2064040/essential-tv-streaming-apps-havent-heard-of/) | Editorial | 12,177 | 2026-01-04 | JustWatch, CheapCharts, Letterboxd, Serializd | Followed (no rel) | Comments | "Haven't heard of" suits a new tool |
| 4 | [BGR: essential apps for every movie lover](https://www.bgr.com/2228732/essential-apps-for-every-movie-lover/) | Editorial | 12,177 | 2026-08-05 | 11 big brands | Followed, App Store links | Methodology section | Big-brand list |
| 5 | [Tom's Guide: 7 ChatGPT entertainment plugins I use every day](https://www.tomsguide.com/ai/i-use-these-7-chatgpt-entertainment-plugins-every-day-and-these-prompts-help-them-deliver-the-best-music-and-movie-recommendations) | Editorial (Future) | 4,768 | **2026-10-17** | Spotify, Apple Music, Tubi, Flixor, GameFinder, Emaqi, Chessy | No outbound tool links | Comments | Best AI fit and very fresh. Mention only, no link. |
| 6 | [Gadget Hacks: TV Time shutdown migration tool](https://cord-cutters.gadgethacks.com/news/how-to-use-the-tv-time-shutdown-migration-tool-before-july-15/) | Editorial | 64,019 | 2026-07-09 / 2026-08-03 | JustWatch, Trakt, Moviebase | Followed (no rel); links moviebase.app | Comments | Has linked a small app. A news item, so it may not be edited again. |
| 7 | [iThinkDiff: best TV Time alternatives](https://ithinkdiff.com/best-tv-time-alternatives-app-store/) | Editorial (Apple blog) | 405,959 | 2026-07-05 | Ten mostly indie apps | Followed, App Store links only | Comments; contact page | Open to small apps, but App Store only |
| 8 | [TechRadar: 5 apps I use instead of scrolling Netflix](https://www.techradar.com/streaming/i-hate-scrolling-endlessly-on-netflix-to-find-something-to-watch-these-are-5-apps-i-use-to-find-new-movies-and-shows-worth-streaming) | Editorial (Future) | 2,386 | 2025-08-14 | JustWatch, Letterboxd, IMDb, Trakt, Fable | No outbound tool links; affiliate links `sponsored` | Comments | Mention only |
| 9 | [PeerPush: Letterboxd alternatives](https://peerpush.com/alternatives/letterboxd) | SEO directory | 449,682 | "Updated October 2026" | Ten indie apps | Profile pages link websites followed | Submission form, price (not verified) | Near-certain inclusion, directory-grade quality, signs of a submission network |
| 10 | [Moviebase: TV Time alternatives](https://moviebase.app/resources/tv-time-alternatives) | Competitor blog | 610,204 | 2026-07-03 / 2026-09-13 | Bingers, Serializd, Trakt, Simkl, Showly | Followed to rivals' websites | Help address in FAQ | Links rivals; GoodWatch is less of a pure-tracker rival. Low odds. |
| 11 | [FlickPicker: TV Time alternatives](https://theflickpicker.com/alternatives/tv-time) | Competitor blog | unranked | 2026-07-26 / 2026-10-01 | Eight trackers | Followed | Contact address | Direct "what to watch" competitor |
| 12 to 14 | CouchTime, NextWatchTV, Limelight tracker and Letterboxd-alternative pages | Competitor blogs | unranked | 2026 | Trackers | Followed, mostly store links | None or contact page | Tiny sites, competitors |
| 15 | [PrivacySavvy: best streaming search engine](https://privacysavvy.com/geoblocking/streaming/best-streaming-search-engine/) | VPN site | 299,523 | 2023 / 2026-01-21 | 21 entries including piracy sites | **nofollow** | Comments | Avoid: piracy neighbours |
| 16 | [Rigorous Themes: best Reelgood alternatives](https://rigorousthemes.com/blog/best-reelgood-alternatives/) | SEO affiliate | 211,331 | 2022 / 2026-02-27 | 20 entries including piracy sites | Followed | Comments | Avoid: link-farm profile |
| 17 | [FirestickTVStream: best JustWatch alternatives](https://firesticktvstream.com/best-justwatch-alternatives/) | IPTV affiliate | unranked | 2026-09-21 | Nine | **nofollow**, `/go/` redirects | Comments | Avoid |
| 18 | Wondershare Recoverit JustWatch and Reelgood alternatives | Vendor SEO | 4,829 | (not verified) | Five | **nofollow** | Contact only | Avoid |
| 19 to 29 | Shortlist, Cinopsys, I Like Movies, Watchd, Matinee, TVGO, TasteRay, Kino, Refract, bobin, Keeprix | Competitor blogs and vendor SEO | mostly unranked | 2026 | Own app first | Own store links or none | Mostly none | No outbound value |
| 30 | Lister.ai "top 10 AI movie recommendation engines" | Pay-to-list directory | unranked | none | Big brands | Internal only | Paid from 99 USD a year | Avoid: pay-to-play |
| 31 | [Tom's Guide: 7 favourite ChatGPT apps](https://www.tomsguide.com/ai/chatgpt/chatgpts-app-store-is-here-and-these-are-my-7-favorite-apps-right-now) | Editorial | 4,768 | 2025-12-18 | Productivity apps | No outbound tool links | Comments | No entertainment slot |
| 32 | [Cloudwards: how to use Reelgood](https://www.cloudwards.net/how-to-use-reelgood/) | VPN site | 58,519 | 2023 / 2026-03-25 | One tool | Followed | Comments | Not a listicle |

Patterns:

- **Who leaves links followed:** Valnet (MakeUseOf, How-To Geek's older pieces, ScreenRant, XDA) and Static Media (BGR) leave tool links followed in this sample, as do Make Tech Easier and iThinkDiff. Round 1 found How-To Geek's 2026 piece nofollow, so check each article. Future plc (Tom's Guide, TechRadar, T3) mostly links nothing in first-person columns and marks affiliate links `sponsored`.
- **The nofollow sites list piracy:** PrivacySavvy, FirestickTVStream, and Wondershare nofollow the tools and sit next to piracy or IPTV sites.
- **About 20 of 33 pages are competitor blogs** written after TV Time closed. Most link rivals by store page or not at all.
- **Refresh habits:** competitor and SEO pages update monthly. Editorial pieces rarely change (BGR and Tom's Guide show modified equal to published), except Make Tech Easier.
- **Store links:** many tracker lists link App Store or Play pages, not websites. GoodWatch has no store app, so it fits "websites" and "tools" lists better than "apps" lists.
- **AI gap:** no editorial "best Claude connectors or MCP servers for movies" list exists. The connector lists found (Composio, Firecrawl, Jotform, Coupler) are all business tools. A first-person "I use GoodWatch inside Claude" column is the open slot; Tom's Guide's 2026-10-17 column shows the format exists.
- **Suggestions:** no page has a "suggest a tool" form. Comments are the only open channel on editorial sites.

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit | Route |
|---|---|---|---|---|---|---|---|
| BGR pitch for the next roundup | Free | 30 minutes | Followed (checked) | Low to medium if included | Low | High | [bgr.com/about](https://www.bgr.com/about/) (bgr.com/contact redirects there) |
| Make Tech Easier: replace the dead TV Time slot | Free | 20 minutes | Followed (checked) | Low | Low | Medium (mobile-app framing) | Comments, or [maketecheasier.com/contact](https://maketecheasier.com/contact/) |
| Tom's Guide AI column follow-up | Free | 20 minutes | None (no outbound links) | Medium visitors if mentioned | Low | High | Tom's Guide contact route |
| PeerPush-type directories | Possibly paid (not verified) | 15 minutes | Followed on profile pages | Very low | Medium (directory network) | Low | Submission form |
| VPN and piracy-adjacent lists | Free | n/a | Mostly nofollow | Very low | High (bad neighbours) | Low | Skip |

## 3. Podcasts

24 shows active in 2025 and 2026 were checked. One episode page per show was read in live HTML. Dedicated cord-cutting podcasts have mostly stopped: the Cord Cutters News and AFTVnews shows and What to Watch's podcast had no 2026 episode (not verified for the first two). Contact routes below are the show's own page; email addresses are on those pages.

| # | Show | Group | Latest episode | Takes guests? | Pitch route | Show-notes link type (checked) | Fit | Owner effort |
|---|---|---|---|---|---|---|---|---|
| 1 | AI Engineering Podcast | AI and MCP | 2026-10-15 | Yes | [Topic-proposal form](https://www.aiengineeringpodcast.com/custompage/guest-info), no fee mentioned | Followed (52 links, no rel; Podhome) | Medium to high: MCP server, local-embedding search under a 1-second budget | 1 hour pitch, 2 to 3 hours recording and prep |
| 2 | Filmspotting: SVU | Film, streaming picks | 2026-10-20 | Hosts plus listener feedback and a recommendation segment | Feedback email on filmspotting.net | Followed on Omny and filmspotting.net | High: streaming movie audience; the Ghibli study fits | 20 minutes (listener email) |
| 3 | Happy Bootstrapping (DE) | Indie makers | 2026-10-15 | Yes, invites self-pitches | [happy-bootstrapping.de/kontakt](https://happy-bootstrapping.de/kontakt/) | Followed (guest links no rel; Podigee branding nofollow) | Medium: solo German founder; a free product with no revenue is a weaker story | 30 minutes pitch, 2 hours recording |
| 4 | programmier.bar (DE) | Developers | 2026-10-20 | Yes, contact page invites guest episodes | [programmier.bar/kontakt](https://www.programmier.bar/kontakt) | Followed (`noreferrer` only) | Medium: Remix, MCP, open-source monorepo | 30 minutes pitch, 2 to 3 hours |
| 5 | The Changelog (News) | Open source | 2026-10-09 | Interviews by request; News takes link submissions | [changelog.com/news/submit](https://changelog.com/news/submit) and [changelog.com/request](https://changelog.com/request) (sign-in) | Topic links followed; guest profile links `external ugc`; sponsors `sponsored` | Medium: MIT monorepo plus MCP | 10 minutes for a News submission |
| 6 | How I AI | AI workflows | 2026-10-19 | Yes | No public form (not verified) | Spotify page links `ugc` | High story fit, large audience; visitors, not link value | High |
| 7 | The PolicyViz Podcast | Data visualization | 2026-10-21 | Yes | [policyviz.com/about/contact](https://policyviz.com/about/contact/) | Followed (`noopener`, `noreferrer`) | Medium: the 139-country study | 30 minutes |
| 8 | HDTV and Home Theater Podcast | Consumer tech | 2026-10-16 | Mostly hosts, reads listener email | Email on [htguys.com/about](https://www.htguys.com/about/) | Followed (21 links, no rel) | Medium: US streaming and devices | 15 minutes |
| 9 | More or Less (BBC) | Numbers | 2026-10-17 | Listener number questions | Email on the BBC programme page | No outbound guest links (coverage, not a link) | Broad: the Ghibli passport is a curiosity | 20 minutes, low odds |
| 10 | Och eine noch! Der Streaming-Podcast (DE) | Streaming | 2026-10-09 | Guests (not verified) | Email in the Podigee show notes | Notes carry no links | High for German streaming fans; mention only | 15 minutes |
| 11 | Rich On Tech | Consumer tech radio | 2026-10-17 | Call-ins, occasional guests | (not verified) | Description links followed; Omny page links nofollow | High audience, low odds | High |
| 12 | Tech News Weekly (TWiT) | Tech news | 2026-10-15 | Reporters | Show email on twit.tv | **nofollow** | Low to medium | High |
| 13 | What's New to Netflix | Netflix reviews | 2026-09-30 | No | None found | No links in notes | Medium topic fit, no route | n/a |
| 14 | Syntax | Web development | 2026-10-21 | Invited guests only | No application | Followed | Medium (Remix, MCP) | High |
| 15 | Practical AI | AI | 2026-10-15 | Yes | (not verified) | Followed (Transistor) | Medium | Medium to high |
| 16 | Latent Space | AI engineering | 2026-10-21 | Invite-led | (not verified) | Followed | Medium | Very high |
| 17 | storytelling with data podcast | Data visualization | 2026-10-21 | Team plus listener questions | [Feedback page](https://www.storytellingwithdata.com/podcast/feedback) | Followed | Low to medium | Medium |
| 18 | The Data Journalism Podcast | Data journalism | 2026-07-29 | The journalists behind a piece | Email in show notes | Spotify page `ugc` | Medium | High |
| 19 | MicroConf On Air, Startups for the Rest of Us, Solo Founders | SaaS founders | October 2026 | Yes, but revenue-focused | Contact pages | Followed (Castos, Transistor) | Low: GoodWatch has no revenue story | High |
| 20 | devtools.fm, Explore Explain, Data Viz Today | Dev tools, data viz | 2026 | Yes | (not verified) | Followed or JS-only | Low | High |

Grading for the channel:

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit |
|---|---|---|---|---|---|---|
| Changelog News submission | Free | 10 minutes | Followed topic link if picked | Low to medium among developers | Low | Medium |
| Filmspotting listener email with the Ghibli finding | Free | 20 minutes | Followed if they link in notes | Low to medium | Low | High |
| AI Engineering Podcast topic proposal | Free | 1 hour plus 3 hours if accepted | Followed | Low (niche), but a durable followed link | Low | Medium to high |
| German guest spots (Happy Bootstrapping, programmier.bar) | Free | 3 hours each if accepted | Followed | Low | Low | Medium |

## 4. Unlinked mentions

### Searches run on 2026-10-21

| Source | Query | Result |
|---|---|---|
| Web search (the session's search tool) | `"goodwatch.app"`, `"GoodWatch" movie app streaming scores`, `"GoodWatch" MCP server movies` | No third-party mention of goodwatch.app. Results were the project's own GitHub issues, the Glama listing, and name collisions. |
| Bing HTML search | `"goodwatch.app"` | Bing ignored the quotes and returned unrelated pages. Not useful by script. |
| Hacker News (Algolia API) | `goodwatch.app`, `goodwatch movie`, `goodwatch mcp` | 0 hits. `goodwatch` alone: 612 hits, mostly the ham-radio watch and the phrase "good watch". |
| Reddit search API | `goodwatch.app`, `"goodwatch"` | HTTP 403 to scripted requests. Run it by hand in a browser (not verified). |
| Bluesky search API | `goodwatch.app`, `goodwatch` | One third-party post about GoodWatch (Undercode News, 2026-10-17). The rest use "#goodwatch" as a phrase or mean the ham-radio watch. |
| Mastodon (mastodon.social API) | `goodwatch.app` | 0 statuses |
| GitHub code search | `"goodwatch.app" -user:<owner>` | 3 files in 2 third-party repos (below) |
| GitHub issue search | `"goodwatch.app"` outside the owner's repos | 4 items: two hobby repos that copy or scrape goodwatch.app pages (no link value), and two unrelated |
| MCP directories (Glama, PulseMCP, Smithery, mcpmarket, LobeHub) | `goodwatch` | Only Glama has a GoodWatch page. The others' search pages render by JavaScript, so a listing there is (not verified). |

### Mentions found

| Page | What it says | Links goodwatch.app? | Link type (checked) | Reclamation move | Value |
|---|---|---|---|---|---|
| [Glama connector page](https://glama.ai/mcp/connectors/app.goodwatch/mcp) | GoodWatch connector, endpoint `https://goodwatch.app/mcp` as text | No. Links the GitHub repo (followed, no rel); "claim connector" link nofollow | Followed (to GitHub) | Glama offers a claim flow that checks a DNS TXT record `_glama-claim.goodwatch.app` (seen in the page data). Claiming may let you add a website link (not verified). Needs a sign-in, so it is an owner action. | Low to medium: Tranco 71,430, MCP audience |
| awesome-jev-projects (search GitHub for "awesome-jev-projects"; site on github.io) | Entry "goodwatch-monorepo: a film-and-TV attribute-scoring experiment inside GoodWatch" | No. README and the entry page link only the GitHub repo | Entry page links GitHub with `noopener noreferrer` (followed) | Ask the maintainer, by issue or pull request, to add the homepage `https://goodwatch.app` to the entry | Low: developer audience, 693 stars |
| awesome-jev (search GitHub for "awesome-jev") | Case-study card for the Jev fingerprint experiment | Yes, an "app" link to goodwatch.app plus repo links | Followed in the GitHub README (GitHub renders README links with `rel="nofollow"`; not verified for this repo) | None needed | Low |
| awesome-ai-rabbit-holes (search GitHub for it) | Catalogue YAML with the repo's homepage field | Data file only, no rendered link found | n/a | None | Very low |
| [Undercode News article](https://undercodenews.com/goodwatch-just-updated-a-closer-look-at-the-open-source-project-video/), 2026-10-17 | Auto-generated piece about the repo having no releases | No. Links the GitHub releases page | Followed (`noopener`); page is `index, follow` | Don't ask. It is machine-written content on an unrelated news site (Tranco 358,602). A link from it carries spam risk, not value. | None |
| SaaSHub listing (already submitted) | Listing | Yes, but to /blog and the status page | `nofollow` (checked) | None | Known from round 1 |

### Name collisions to filter out

| Name | What it is | How to exclude it in searches |
|---|---|---|
| GoodWatch ham-radio wristwatch | Open-source replacement board and firmware for Casio calculator watches, on goodwatch.org and a GitHub repo with about 569 stars, plus forks and related repos. On Hacker News in 2017, 2019, and 2024. | `-casio -radio -ham -"calculator watch"` |
| GoodWatch - Original Shows | iOS kids' streaming app by Humans Anonymous, Inc., released May 2026 ([appgoblin listing](https://appgoblin.info/apps/6761436542)) | `-"Original Shows" -"sleep stories"` |
| GoodWatch GitHub organization | "An open source movie library platform", last pushed 2022 | Exclude github.com/GoodWatch |
| Student movie-recommender repos named goodwatch | Several small repos (Android recommender, neo4j recommender) | Search `goodwatch.app`, not the bare name |
| "#goodwatch" hashtag and the phrase "good watch" | Social posts recommending a show | Always search the domain, not the word |
| Good Technology "Good for Apple Watch" (2015), Samsung community "GoodWatch" suggestion (2023) | Unrelated | Exclude by date |

### Free monitoring setup

| Tool | What it covers | Cost | Owner effort | Notes |
|---|---|---|---|---|
| Google Alerts ([google.com/alerts](https://www.google.com/alerts)) | New Google-indexed pages | Free | 5 minutes | Queries: `"goodwatch.app"` and `"GoodWatch" (movie OR streaming OR Netflix) -casio -"Original Shows"` |
| Talkwalker Alerts ([talkwalker.com/alerts](https://www.talkwalker.com/alerts)) | News, blogs, forums, X | Free ("Best free, easy alternative to Google Alerts" on the page) | 5 minutes | Same queries |
| Bluesky and Hacker News search APIs | Social and HN mentions | Free | A 10-line script, or a weekly manual search | Worked by script today |
| Ahrefs Webmaster Tools ([ahrefs.com/webmaster-tools](https://ahrefs.com/webmaster-tools)) | Backlinks to a verified site (up to 1,000 shown), link types, broken links | Free after site verification | 15 minutes | Shows links, not unlinked mentions. Ahrefs' mention tracking sits in paid Content Explorer. |
| Google Search Console Links report and Bing Webmaster Tools | Backlinks Google and Bing know about | Free | Already set up for Search Console (see the SEO indexing investigation) | Confirms whether reclaimed links got crawled |

## 5. Broken-link building on movie resource pages

36 tools were checked with curl (status, final URL, title) and the Wayback Machine (CDX captures). Eight are dead or no longer do their job and have a GoodWatch equivalent. Several dead tools never look broken: tvtime.com and canistream.it still answer HTTP 200 with a farewell or placeholder page, and flixable.com redirects to What's on Netflix. Broken-link checkers that look for 404s miss them, so each linking page was grepped for the dead domain instead.

### Tool status

| Tool | What it did | Live check | Wayback evidence | Status |
|---|---|---|---|---|
| Can I Stream It (canistream.it) | Where a title streams, rents, or sells | 200, a default WordPress starter page | Last working page 2019-12-16; "rebuilding" sign-up page in 2024; starter page through 2026-10-06 | Dead, still answers 200 |
| Graph TV (graphtv.kevinformatics.com) | IMDb episode-rating charts | 404, Heroku "No such app" on every path | Last capture 2022-11-20; Heroku's free tier ended 2022-11-28 (inference) | Dead since late 2022 |
| TV Time (tvtime.com) | Episode and movie tracking | 200, "Thank You" farewell page on every path | Full site 2026-07-01, farewell by 2026-07-20 | Shut down 2026-07-15, still answers 200 |
| Instantwatcher | Netflix and Prime catalogue browser with filters | 403 on every path, certificate of an unrelated host | Relaunched pages captured up to 2026-07-09; 403 captured 2026-10-07 | Broken since mid-2026, may be temporary |
| Flixable (flixable.com) | Netflix catalogue browser | 301 to What's on Netflix | "Flixable is Closed" page 2025-03-15 | Closed. The old flixable.co domain now hosts drug-information content. |
| Jinni | Mood and taste recommendations | Bare domain is an unrelated app | Consumer site last seen 2015-05-30 | Dead since 2015, domain reused |
| GetGlue | Social TV check-ins | 200, now an adult-site directory | Renamed tvtag in 2014, closed about 2015 | Domain reused for adult content |
| Fan TV (fan.tv) | Where to watch | No DNS | Last capture 2018-04-15 | Dead |
| Others dead or folded | Movie Pilot (moviepilot.com), TV.com, Showyou, nextflick.io, Foundd, Clerkdogs dead; AllFlicks and Netflix Roulette folded into Reelgood; Flixster into Fandango; Nanocrowd business-only | | | Lower value: no maintained pages found, or no GoodWatch fit |
| Live (no target) | uNoGS, Reelgood, MovieLens, Taste.io, Criticker, iCheckMovies, Agoodmovietowatch, Yidio, Flickmetrix, TasteDive, Simkl, whattowatchon.tv, Series Graph, Tunefind, Moviefone | 200 or a Cloudflare challenge | Recent captures | Live |

### Pages that still link the dead tools

"Followed" means the link in the live HTML has no `nofollow`, `ugc`, or `sponsored`. Two rows were re-checked by a second curl on 2026-10-21 (UNC streaming guide, FlowingData).

| Dead tool and GoodWatch fit | Linking page | Owner type | Link in live HTML | rel | Contact route |
|---|---|---|---|---|---|
| Can I Stream It. Strong fit: where it streams in 139 countries | [UNC film and media studies guide, streaming page](https://guides.lib.unc.edu/filmandmediastudies/stream) (updated 2026-09-25) | University library | Yes | Followed | [library.unc.edu/ask](https://library.unc.edu/ask/) |
| | [UNC streaming guide](https://guides.lib.unc.edu/streaming/stream) (updated 2026-10-14) | University library | Yes (re-checked) | Followed | Same |
| | [GeekWire app of the week, 2015](https://www.geekwire.com/2015/app-of-the-week-canistream-it-helps-you-find-movies-and-shows-across-multiple-services/) | Outlet | Yes (3 links) | Followed | [geekwire.com/contact-us](https://www.geekwire.com/contact-us/) |
| | [TidBITS, 2019-06-21](https://tidbits.com/2019/06/21/a-million-streams-and-nothing-to-watch-reelgood-and-justwatch-to-the-rescue/) | Outlet | Yes | Followed | [tidbits.com/about/contact](https://tidbits.com/about/contact/) |
| | [Streaming Media news item](https://www.streamingmedia.com/Articles/News/Online-Video-News/Can-You-Stream-It-This-Site-Answers-the-Question-79052.aspx) | Trade outlet | Yes | Followed | (not verified) |
| | [Fox News tech item](https://www.foxnews.com/tech/can-i-stream-it-a-tv-guide-for-online-video) | Outlet | Yes (2 links) | Followed | [foxnews.com/contact](https://www.foxnews.com/contact) |
| | [PrivacySavvy streaming search engines](https://privacysavvy.com/geoblocking/streaming/best-streaming-search-engine/) (modified 2026-01-21) | VPN site | Yes | nofollow | Skip (piracy neighbours, section 2) |
| Graph TV. Strongest fit: the season and episode grid, with RT and Metacritic season scores | [FlowingData, 2014-03-24](https://flowingdata.com/2014/03/24/graph-tv-shows-ratings-by-episode/) | Data-visualization outlet | Yes (6 links, re-checked) | Followed | [flowingdata.com/contact](https://flowingdata.com/contact/) |
| | [Laughing Squid](https://laughingsquid.com/graph-tv-a-web-tool-that-creates-fascinating-graphs-based-on-the-ratings-of-television-show-episodes/) | Outlet | Yes (5 links) | Followed (`external noopener`) | [laughingsquid.com/contact](https://laughingsquid.com/contact/) |
| | [It's Nice That](https://www.itsnicethat.com/articles/graph-tv) | Design outlet | Yes | Followed | [itsnicethat.com/contact](https://www.itsnicethat.com/contact) |
| | [The Mary Sue](https://www.themarysue.com/tv-ratings-graphs/) | Outlet | Yes | Followed | [themarysue.com/contact](https://www.themarysue.com/contact/) |
| | [Information is Beautiful Awards showcase](https://www.informationisbeautifulawards.com/showcase/844-graph-ratings-of-your-favorite-tv-shows) | Awards archive | Yes | Followed | (not found) |
| | [TIME](https://time.com/28906/this-website-graphs-the-popularity-of-tv-shows/) and a BuzzFeed list | Outlets | Yes (read through a fetch tool, curl blocked) | (not verified) | (not verified) |
| TV Time. Strong fit: episode tracking, and GoodWatch imports TV Time exports (`goodwatch-webapp/app/domain/imports.ts` lists "TV Time" with a `gdpr-data.zip` hint) | [Consumer Reports: find where shows and movies are streaming](https://www.consumerreports.org/electronics-computers/streaming-media/find-where-shows-and-movies-are-streaming-a3855465221/) (modified 2024-05-02) | Outlet | Yes | Followed (`noreferrer noopener`) | (not verified) |
| | [How-To Geek: keep track of the TV shows you're watching](https://www.howtogeek.com/693257/how-to-keep-track-of-the-tv-shows-youre-watching/) | Outlet (Valnet) | Yes | Followed | [howtogeek.com/contact](https://www.howtogeek.com/contact/) |
| | [Make Tech Easier tracker list](https://www.maketecheasier.com/mobile-apps-track-tv-shows/) (modified 2026-10-10) | Outlet | Yes (section 2) | Followed | [maketecheasier.com/contact](https://maketecheasier.com/contact/) |
| | [TechCrunch, 2018](https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge/) | Outlet | Yes | nofollow | Skip |
| Instantwatcher. Fair fit: Discover filters by service and score. Re-check before any email, it may return | [Ohio University film studies websites](https://libguides.library.ohio.edu/filmstudies/websites) (updated 2025-11-19) | University library | Yes | Followed | [ohio.edu/library/help](https://www.ohio.edu/library/help) |
| | [Ohio University film and media websites](https://libguides.library.ohio.edu/filmandmedia/websites) | University library | Yes | Followed | Same |
| | [Engadget, 2014](https://www.engadget.com/2014-07-25-how-to-netflix-better.html) | Outlet | Yes | Followed | [engadget.com/about](https://www.engadget.com/about/) |
| Jinni. Partial fit: taste picks, but GoodWatch has no mood search | [Gizmodo: 7 sites to choose what to watch next](https://gizmodo.com/7-sites-to-choose-what-to-watch-next-1682014551) (also links Foundd, now for sale) | Outlet | Yes | Followed | (not found) |
| Flixable (flixable.co now hosts drug content). Fair fit | [Cultbox](https://cultbox.co.uk/news/headlines/this-might-just-be-the-best-site-yet-for-exploring-netflix) | Outlet | Yes | Followed | [cultbox.co.uk/contact](https://cultbox.co.uk/contact) |
| GetGlue (domain now adult). Weak feature fit; the case is reader safety | [ABC News technology blog, 2012](https://abcnews.go.com/blogs/technology/2012/08/get-glue-hd-simplifies-finding-whats-on-tv) | Outlet | Yes (2 links) | Followed | [abcnews.com/contact](https://abcnews.com/contact) |
| Fan TV. Fair fit: where to watch | [AFTVnews, Fan TV app](https://www.aftvnews.com/fan-tv-app-gives-amazon-fire-tv-owners-a-new-way-to-discover-movies-and-tv-shows/) | Outlet | Yes | Followed | [aftvnews.com/contact](https://www.aftvnews.com/contact/) |

How to find more:

- Search quoted tool names with "libguides" or "research guide" and "film"; `site:libguides.com` returned noise. Library guides often copy a tool's blurb, so searching the blurb text also works.
- Sweep film and streaming library guides that list JustWatch or Reelgood and grep each for dead domains. About 4 of roughly 45 guides checked had a hit. The guide's "Last Updated" line shows whether someone still maintains it.
- Wayback CDX for when a site died: `https://web.archive.org/cdx/search/cdx?url=DOMAIN/&output=txt&collapse=timestamp:6&filter=statuscode:200&fl=timestamp,length`. A sudden drop in page size marks the death; confirm with a capture's title at `https://web.archive.org/web/<timestamp>id_/http://DOMAIN/`. The endpoint rate-limits; wait a few seconds between calls.
- Wikipedia's external-link API counts citing articles, for example `https://en.wikipedia.org/w/api.php?action=query&list=exturlusage&euquery=www.tvtime.com&eunamespace=0&eulimit=500&format=json`: tvtime.com 151, instantwatcher.com 34, flixable.com 10, getglue.com 7, jinni.com 5. These are nofollow and not outreach targets (section 6), but they show which dead domains are still widely linked.
- Ahrefs' free Backlink Checker shows about the top 100 linking pages per domain behind a captcha (not verified, not run). Run it on canistream.it, graphtv.kevinformatics.com, tvtime.com, instantwatcher.com, and jinni.com. Its broken-link view will not flag the soft-dead sites that still answer 200.

Caveats: old news articles are rarely edited, so expect replies mainly from maintained library guides (UNC, Ohio University) and refreshed listicles (Make Tech Easier, Consumer Reports). rel values come from the server HTML; JavaScript could change them. Fast Company, AJC, PhoneArena, and TrendHunter pages could not be checked. One personal blog that links Graph TV was left out on purpose.

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit | Route |
|---|---|---|---|---|---|---|---|
| UNC and Ohio University library guides (4 pages) | Free | 1 hour for 2 emails | Followed (checked) | Low visitors (students), durable .edu links | Low, if the email is a plain "this link is dead, here is a free replacement" | High | Library ask and help pages |
| Graph TV pages (FlowingData, Laughing Squid, It's Nice That, The Mary Sue) | Free | 1 hour for 4 short emails | Followed (checked) | Low to medium; the episode grid is a direct replacement | Low | High | Contact pages above |
| TV Time pages (Consumer Reports, How-To Geek, Make Tech Easier) | Free | 45 minutes | Followed (checked) | Low to medium | Low | High: GoodWatch imports TV Time exports | Contact pages above |
| Old news articles (GeekWire, TidBITS, Fox News, Engadget, ABC News, Cultbox, AFTVnews) | Free | 15 minutes each | Followed (checked) | Very low; editors rarely update 2012 to 2019 posts | Low | Medium | Contact pages above |

## 6. Wikipedia

Round 1 rejected adding GoodWatch to Wikipedia. This round looked for a non-promotional angle: a citation to the published study on an article about streaming geo-restriction, added by someone other than the owner.

| Rule | What it says | Effect on the study |
|---|---|---|
| WP:SPS ([Verifiability](https://en.wikipedia.org/wiki/Wikipedia:Verifiability#Self-published_sources)) | "Self-published sources may be considered reliable if published by an established subject-matter expert, whose work in the relevant field has previously been published by reliable, independent publications." It adds that if the information is suitable, "someone else will likely have published it in independent, reliable sources." | A GoodWatch blog post is self-published. Until a reliable outlet reports the findings, the study is not citable. |
| WP:SELFCITE ([Conflict of interest](https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest#Citing_yourself)) | Citing your own work "is allowed within reason, but only if it is relevant, conforms to the content policies, including WP:SELFPUB, and is not excessive." "When in doubt ... propose the edit on the article's talk page." | The owner could only propose on a talk page, and the source would still fail WP:SPS. |
| WP:REFSPAM ([Spam](https://en.wikipedia.org/wiki/Wikipedia:Spam#Citation_spam)) | Citation spamming "typically involves the repeated insertion of a particular citation or reference in multiple articles by a single contributor", including "people replacing live or dead URLs with links to commercial sites or their own blogs". | Asking a friend to add it is the same pattern by proxy. |
| Link type | Wikipedia external links are nofollow (round 1 checked) | No ranking value in any case |

What exists: the English [Geo-blocking](https://en.wikipedia.org/wiki/Geo-blocking) article already explains territorial rights for audiovisual works without catalogue numbers. The [Netflix](https://en.wikipedia.org/wiki/Netflix) article cites What's on Netflix twice and uNoGS once (counted in the raw wikitext), so independent catalogue trackers do get cited once secondary sources exist.

Verdict: don't, and don't ask anyone to. If a reliable outlet (for example What's on Netflix, The Verge, or heise) reports the study, an uninvolved editor may cite that outlet. That is the only path, and it is not one you can steer.

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit |
|---|---|---|---|---|---|---|
| Cite the study on Wikipedia | Free | n/a | nofollow | Near zero | High (spam blacklist across Wikimedia sites, reputation) | Don't |

## 7. German and EU media

### The German angle from the study

From `goodwatch-webapp/app/content/blog/streaming-by-country-2026/data.json` (snapshot 2026-10-18, 4,683 movies and 717 shows):

- Germany streams 3,250 of the 4,683 movies on a subscription (8th of 56 larger markets; the US leads with 3,478).
- Netflix Germany carries 578 of them, 47th of 55 markets with Netflix. Switzerland is first with 799; Austria has 581.
- The biggest single service for these movies in Germany is Disney+ (769), not Netflix. Austria is the same (690).
- 534 of the movies stream free with ads in Germany.
- Shows: Germany has 622 of 717 (6th); Netflix is biggest with 250.

Hook in German: Netflix raised every German plan by 2 EUR from 2026-09-03 ([GamePro](https://www.gamepro.de/artikel/netflix-deutschland-preiserhoehung-2026,3459094.html)), and a Swiss subscriber gets 221 more of these movies. JustWatch, a Berlin company, became a streamer on 2026-10-20, with Germany, Austria, and Switzerland in the first wave ([WinFuture](https://winfuture.de/news,161319.html), [Quotenmeter](https://www.quotenmeter.de/n/175554/justwatch-wird-selbst-zum-streamingdienst)).

### German outlets

Link type is from recent articles' live HTML ("followed" means editorial links have no `nofollow`, `ugc`, or `sponsored`).

| Outlet | Beat fit and recent evidence | Tranco | Editorial link type (checked) | Tip route | Fit |
|---|---|---|---|---|---|
| heise online | IT news, policy; covers streaming business | 2,682 | Followed (`external noopener`, for example to oracle.com and developer.android.com) | [heise.de/kontakt](https://www.heise.de/kontakt/) | Medium: data and EU policy angle, open-source angle |
| t3n | Digital business, apps; Spotify family-plan story 2026-10 | 15,605 | Followed (no rel) | [t3n.de/kontakt](https://t3n.de/kontakt/): "Du hast Themenvorschläge, Artikelideen ...?" with an editorial role address | High: solo developer, AI connector, data |
| Golem.de | IT news | 12,583 | (not verified: sampled articles had no external links) | [Impressum](https://www.golem.de/sonstiges/impressum.html); the contact page sits behind a consent wall | Medium |
| netzwelt | Streaming news; JustWatch launch 2026-09-21 | 15,334 | **nofollow** (even the justwatch.com link) | Editorial role address in the [Impressum](https://www.netzwelt.de/impressum.html) | Mention value |
| Moviepilot (Webedia) | Film and series news | 14,198 | **nofollow** (`noopener noreferrer nofollow` to deadline.com) | Not found at /kontakt (not verified) | Mention value, big film audience |
| Filmstarts (Webedia) | Film news | 7,364 | (not verified) | Editorial role address in the [Impressum](https://www.filmstarts.de/service/kontakt/) | Mention value |
| Serienjunkies (Ippen) | Series news; Disney+ and Hulu prices | 52,948 | **nofollow** (rottentomatoes.com) | (not verified) | Mention value |
| Quotenmeter | TV and streaming business; JustWatch launch | 118,286 | (not verified) | (not verified) | Medium: industry readers |
| DWDL.de | TV and streaming business, ratings data | 60,531 | Followed (no rel) | [Impressum](https://www.dwdl.de/impressum/) | Medium: catalogue and market data |
| Caschys Blog | Tech blog with a tip form | 40,152 | Editorial followed (`noopener noreferrer`); affiliate `nofollow sponsored` | [Tipp senden form](https://stadt-bremerhaven.de/tipp-senden/). The Impressum says link swaps or bought links don't exist there. | High: takes reader tips, covers web services |
| iphone-ticker.de (ifun) | Covers German solo developers' free film apps ("Movie Manager", 2026-06-19) | 140,352 | Followed (no rel) | [Kontakt](https://www.iphone-ticker.de/kontakt/): "Du bist Entwickler ...? Schreib uns" | Medium: iPhone focus; GoodWatch is a website, so pitch the mobile web experience |
| appgefahren.de | Same indie film-app coverage (Movie Manager, 2026-06-22) | 280,160 | (not verified for app links) | (not verified) | Medium, iOS focus |
| mobiFlip | Mobile and streaming news; Netflix price stories | 167,873 | Followed (no rel) | [mobiflip.de/kontakt](https://www.mobiflip.de/kontakt/) (tip and press role addresses) | Medium |
| Mobilegeeks | Now redirects to Basic Thinking (301 to basicthinking.de/blog) | 78,914 (basicthinking.de) | Mixed: editorial mostly followed, some `nofollow` | (not verified) | Low |
| inside digital | Telecom and streaming; JustWatch TV 2026-10-09 | 58,391 | Followed (`noopener` to bitkom.org); deals `nofollow sponsored` | [inside-digital.de/kontakt](https://www.inside-digital.de/kontakt) | High for the free-with-ads and price angle |
| GIGA and kino.de (Ströer) | Streaming; JustWatch TV 2026-10-07 and 2026-10-20 | 5,980 and 7,012 | (not verified) | Editorial role addresses in the [GIGA](https://www.giga.de/impressum/) and [kino.de](https://www.kino.de/impressum/) Impressum | Mention value, very large audience |
| WinFuture | Tech news; JustWatch and Netflix price stories | 25,157 | (not verified: sampled links were to its own forum) | Press role address in the [Impressum](https://winfuture.de/impressum.html) | Medium |
| Gründerszene (Business Insider) | Funded startups, "Die Höhle der Löwen" | 16,153 (businessinsider.de) | (not verified) | [Kontakt](https://www.businessinsider.de/gruenderszene/kontakt/) and a leak form | Low: GoodWatch has no funding or revenue story |
| deutsche-startups.de | Startup news | 153,761 | (not verified) | [Kontakt](https://www.deutsche-startups.de/kontakt/): readers can send a "Tipp" | Low, same reason |
| netzpolitik.org | Digital policy | 21,191 | Followed (`noopener`) | Site in maintenance during the check (not verified) | Medium for the EU geo-blocking angle only |

Regional newspapers: no 2024 to 2026 example of a regional paper covering a local solo web developer turned up in two searches (not verified that none exist). The closer precedent is iphone-ticker and appgefahren covering a German hobby developer's free film app in June 2026. A regional "Lokales" desk is still worth one email if you want it, because local papers cover residents' projects, but expect a print mention with no link.

German listicles: no German "JustWatch-Alternativen" or "Letterboxd-Alternativen" piece from 2025 or 2026 turned up; German coverage of the topic is news about JustWatch TV and MonsterDealz's JustWatch guide (updated 2026-10-15). (Not exhaustive.)

### EU angle: the Geo-blocking Regulation review

Primary facts:

- Regulation (EU) 2018/302 "does not apply to the activities referred to in Article 2(2) of Directive 2006/123/EC" (Article 1(3)), which include audiovisual services. Its ban on different access conditions for electronically supplied services excludes "services the main feature of which is the provision of access to and use of copyright protected works" (Article 4(1)(b)). Text from the [UK legislation.gov.uk copy of the regulation as adopted](https://www.legislation.gov.uk/eur/2018/302/contents/adopted); the EUR-Lex original is [CELEX 32018R0302](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018R0302).
- Article 9: the Commission reports "By 23 March 2020 and every five years thereafter", and the first evaluation was to assess "whether this Regulation should also apply to electronically supplied services the main feature of which is the provision of access to and use of copyright protected works".
- The current evaluation ([Have your say, initiative 14416](https://ec.europa.eu/info/law/better-regulation/have-your-say/initiatives/14416-Geo-blocking-Regulation-evaluation_en), read through its public JSON): call for evidence 2025-02-11 to 2025-03-11 (598 responses); public consultation 2025-10-06 to 2026-01-05 (187 responses); the evaluation report is planned for Q3 2026 and was not yet published on the record I read. A LexisNexis summary gives a 2026-12-29 consultation deadline; the Commission's own record says 2026-01-05, so use the Commission's date.
- The European Court of Auditors' [Special report 03/2025](https://www.eca.europa.eu/ECAPublications/SR-2025-03/SR-2025-03_EN.pdf), Recommendation 1: the Commission "should carry out a study ... to assess the benefits, challenges and possible risks of extending the scope of the Regulation to the sectors that are currently excluded". "Target implementation date: end of 2026."

How the study fits: it measures exactly what the excluded sector looks like for consumers, with neighbouring EU countries showing different catalogues for the same subscription (Netflix: Austria 581, Germany 578, France 648 of the same 4,683 movies; Switzerland, outside the EU, 799). That is a policy data point, not a product pitch. Targets: netzpolitik.org and heise in Germany; EU policy outlets such as Euractiv (not checked in this session). Timing: when the Commission publishes the evaluation report, which is due.

| Item | Cost | Owner effort | Link type | Expected referral value | Risk | Fit | Route |
|---|---|---|---|---|---|---|---|
| t3n pitch: solo developer, AI connector, Netflix Germany 47th of 55 | Free | 30 minutes | Followed (checked) | Medium if published (estimate) | Low | High | t3n Kontakt |
| Caschys Blog tip form | Free | 15 minutes | Followed editorial links (checked) | Medium for a day | Low | High | Tip form |
| inside digital, mobiFlip pitches on the price rise | Free | 30 minutes for both | Followed (checked) | Low to medium | Low | High | Kontakt pages |
| GIGA, kino.de, Moviepilot, netzwelt | Free | 30 minutes | Mostly nofollow (checked for Moviepilot and netzwelt) | Medium visitors, no ranking credit | Low | Medium | Impressum role addresses |
| EU geo-blocking data note to heise or netzpolitik.org when the evaluation report appears | Free | 1 hour | Followed (checked) | Low to medium, policy readers | Low | Medium | Kontakt pages |
| Gründerszene, deutsche-startups.de | Free | 30 minutes | (not verified) | Low | Low | Low (no startup story) | Kontakt pages |

## Recommended moves

Ranked by value per owner hour. Hours are estimates.

| Rank | Move | Owner hours | Link type | Why this rank |
|---|---|---|---|---|
| 1 | **Pitch three JustWatch-launch writers this week** (The Verge, Cord Cutters News, What's on Netflix), one finding each, once the study is published | 1.5 | Followed at all three (checked) | The news is two days old, the writers just covered the exact category, and all three leave links followed. Highest odds of an editorial link per hour. |
| 2 | **German trio: t3n, Caschys Blog tip form, inside digital** with the Netflix Germany 47th-of-55 and Disney+-is-biggest numbers | 1 | Followed (checked) | German-language angle no US outlet will run, a JustWatch-in-Berlin hook, and followed links. You can write the German pitches without translation. |
| 3 | **Claim the Glama connector page and ask awesome-jev-projects to add the homepage link** | 0.5 | Followed (both pages link out without rel) | Two existing mentions turn into goodwatch.app links for a few minutes each. Low value each, but the cheapest links available. |
| 4 | **Set up Google Alerts and Talkwalker Alerts** for `"goodwatch.app"` with the collision exclusions | 0.25 | n/a | Catches future unlinked mentions as soon as press starts. Pays off only after moves 1 and 2. |
| 5 | **Changelog News submission and a Filmspotting listener email** | 0.5 | Followed (checked) | Ten and twenty minutes; developer and film audiences respectively. |
| 6 | **BGR and Make Tech Easier**: pitch BGR for its next "instead of IMDb" roundup; offer Make Tech Easier GoodWatch for the dead TV Time slot | 0.75 | Followed (checked) | Real outlets that link tools with followed links. Inclusion odds are low, so it ranks below the news pitches. |
| 7 | **AI Engineering Podcast topic proposal** (MCP server, local-embedding search) | 1 plus 3 if accepted | Followed (checked) | A durable followed link and a technical audience, but a large time cost if accepted. |
| 8 | **Broken-link emails, library guides first**: UNC (Can I Stream It) and Ohio University (Instantwatcher, re-check first), then the four Graph TV pages and the three TV Time pages | 2.5 for about 9 short emails | Followed on every page listed (checked) | Pre-qualified pages that already link a dead tool of the same kind. Maintained library guides reply most often; 2014 articles rarely get edited, which keeps this below the news pitches. |

## Skip list

| Item | Reason |
|---|---|
| Wikipedia citation of the study | Fails WP:SPS until a reliable outlet reports it; self-citation and proxy edits look like citation spam; nofollow |
| VPN-affiliate and piracy-adjacent listicles (PrivacySavvy, FirestickTVStream, Rigorous Themes, Wondershare) | nofollow or link-farm profile, next to piracy sites |
| Pay-to-list directories (Lister.ai at 99 USD a year, PeerPush-style submission networks) | Paid placement; low quality |
| Competitor app blogs (about 20 of the 33 listicles) | They link rivals by store page or not at all, and rarely add a competitor |
| Undercode News and similar auto-generated sites | Machine-written; a link there is a spam signal |
| Muck Rack by script | Blocks automated reads; use it by hand only if at all |
| Gründerszene and deutsche-startups.de | They cover funded startups; GoodWatch has no funding or revenue story |
| Everyday AI podcast | Sponsorship "guarantees a guest interview" (pay to play) |
| Inactive podcasts (Indie Hackers podcast, Indie Bites, Data Stories, The Letterboxd Show, Engineering Kiosk, cord-cutting shows) | No episode since 2023 to mid-2025, or paused |
| Pitching JustWatch's press team | JustWatch is now a streamer and a competitor; GoodWatch credits its data, which is enough |
| TechCrunch, BetaNews, T3 for link value | nofollow or sponsored on every outbound link checked. Pitch them only for visitors. |

## Sources

All accessed 2026-10-21.

Hooks and press:
- https://techcrunch.com/2026/10/20/streaming-guide-justwatch-becomes-a-streamer-itself/
- https://www.theverge.com/entertainment/1014640/justwatch-tv-plus-free-store-streaming-service-movie-rental
- https://cordcuttersnews.com/the-app-that-tells-you-where-to-stream-is-launching-its-own-streaming-service-with-free-movies-rentals-and-more/
- https://www.thewrap.com/media-platforms/streaming/justwatch-tv-streaming-service-explained/
- https://www.hollywoodreporter.com/tv/tv-news/justwatch-tv-new-streaming-service-1236700561/
- https://www.t3.com/entertainment/streaming/unmissable-new-free-streaming-service-arrives-in-the-uk-next-month-heres-why-that-matters
- https://betanews.com/article/justwatch-streaming-service-launch/
- https://techradar.com/streaming/streaming-guide-justwatch-is-launching-its-own-platform-with-both-free-and-paid-tiers-and-i-think-its-already-matching-the-likes-of-tubi-heres-why
- https://www.tomsguide.com/entertainment/disney-plus/disney-confirms-another-price-hike-heres-how-much-youll-pay-now
- https://variety.com/2026/tv/news/disney-plus-hulu-price-increase-2026-1236873281/
- https://www.cbsnews.com/news/disney-plus-hulu-price-increase/
- https://fortune.com/2026/09/09/streaming-service-prices-2026-cord-cutting-cable/
- https://www.whats-on-netflix.com/news/netflix-library-by-the-numbers-2025-597-new-originals-released-and-library-swells-to-almost-8000-titles
- https://www.pocket-lint.com/streaming-password-sharing-crackdown-2026/
- https://screencrush.com/netflix-raising-prices-2026/
- https://www.adslzone.net/noticias/streaming-tv/netflix-mantiene-peliculas-studio-ghibli/
- https://thebestvpn.com/statistics/netflix-library-size-by-country/
- Tip and contact pages: https://techcrunch.com/got-a-tip/, https://www.theverge.com/contact, https://cordcuttersnews.com/contact-us/, https://www.whats-on-netflix.com/about/, https://www.pocket-lint.com/contact/, https://www.techradar.com/how-to/contact-us, https://variety.com/static-pages/contact-us/, https://betanews.com/contact/, https://screencrush.com/contact-us/, https://www.justwatch.com/us/press
- Google News RSS: https://news.google.com/rss/search?q=%22Netflix%22+catalogue+OR+catalog+country+when:30d&hl=en-US&gl=US&ceid=US:en
- Bluesky starter-pack search: https://api.bsky.app/xrpc/app.bsky.graph.searchStarterPacks?q=tv%20critics
- Tranco list (local copy of the top 1 million, https://tranco-list.eu)

Listicles, podcasts, and broken-link pages: the article, show, and linking-page URLs in sections 2, 3, and 5, plus Wayback CDX (https://web.archive.org/cdx/search/cdx) and the Wikipedia exturlusage API.

Unlinked mentions:
- https://hn.algolia.com/api/v1/search?query=goodwatch
- https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=goodwatch
- https://glama.ai/mcp/connectors/app.goodwatch/mcp
- https://undercodenews.com/goodwatch-just-updated-a-closer-look-at-the-open-source-project-video/
- https://appgoblin.info/apps/6761436542
- https://www.talkwalker.com/alerts, https://www.google.com/alerts, https://ahrefs.com/webmaster-tools
- GitHub code and issue search via `gh api search/code` and `search/issues`

Wikipedia:
- https://en.wikipedia.org/wiki/Wikipedia:Verifiability#Self-published_sources
- https://en.wikipedia.org/wiki/Wikipedia:Conflict_of_interest#Citing_yourself
- https://en.wikipedia.org/wiki/Wikipedia:Spam#Citation_spam
- https://en.wikipedia.org/wiki/Geo-blocking, https://en.wikipedia.org/wiki/Netflix

German and EU:
- https://www.gamepro.de/artikel/netflix-deutschland-preiserhoehung-2026,3459094.html
- https://winfuture.de/news,161319.html
- https://www.quotenmeter.de/n/175554/justwatch-wird-selbst-zum-streamingdienst
- https://www.netzwelt.de/news/258744-bekannte-streaming-suchmaschine-justwatch-fuehrt-eigenen-streamingdienst-macht-netflix-keine-konkurrenz.html
- https://www.inside-digital.de/news/fuer-alle-kostenlos-neuer-streamingdienst-gestartet
- https://www.giga.de/entertainment/konkurrenz-fuer-netflix-neuer-kostenloser-streamingdienst-startet-in-deutschland--01M2QT547Z9ER313YW81AFGHNV
- https://www.iphone-ticker.de/movie-manager-kostenloses-werkzeug-fuer-film-und-serienfans-280025/
- https://www.appgefahren.de/movie-manager-verraet-euch-wo-ein-filme-laeuft-401220.html
- https://www.monsterdealz.de/magazin/justwatch
- Contact pages: https://t3n.de/kontakt/, https://stadt-bremerhaven.de/impressum/, https://stadt-bremerhaven.de/tipp-senden/, https://www.iphone-ticker.de/kontakt/, https://www.mobiflip.de/kontakt/, https://www.inside-digital.de/kontakt, https://www.netzwelt.de/impressum.html, https://www.filmstarts.de/service/kontakt/, https://www.giga.de/impressum/, https://www.kino.de/impressum/, https://winfuture.de/impressum.html, https://www.businessinsider.de/gruenderszene/kontakt/, https://www.deutsche-startups.de/kontakt/, https://www.heise.de/kontakt/
- https://www.legislation.gov.uk/eur/2018/302/contents/adopted (articles 1, 4, and 9)
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018R0302
- https://ec.europa.eu/info/law/better-regulation/have-your-say/initiatives/14416-Geo-blocking-Regulation-evaluation_en and its JSON at https://ec.europa.eu/info/law/better-regulation/brpapi/groupInitiatives/14416
- https://single-market-economy.ec.europa.eu/news/commission-launches-evaluation-geo-blocking-regulation-2025-02-11_en
- https://www.lexisnexis.co.uk/legal/news/commission-launches-consultation-on-evaluation (secondary; its deadline conflicts with the Commission record)
- https://www.eca.europa.eu/ECAPublications/SR-2025-03/SR-2025-03_EN.pdf

# Backlinks round 2, channel 2: open-source and data angles

Researched 2026-10-21. Research only: nothing was posted, submitted, signed up for, or sent. This file covers awesome lists beyond the ones round 1 graded, open-source alternative directories, GitHub-side discoverability, vendor and framework showcases, and dataset portals for the streaming study's CSV files, including what the TMDB, JustWatch, and IMDb terms allow you to release. Round 1's [04-listings-registries.md](../backlinks/04-listings-registries.md) (awesome lists, credit pages, open-source ideas) and [07-dev-platforms.md](../backlinks/07-dev-platforms.md) are not repeated. Link types were read from live HTML with curl unless a row says otherwise. "Followed" means the outbound link had no `nofollow`, `ugc`, or `sponsored` value. GitHub README links are nofollow (round 1), so every awesome list gives a nofollow link unless it has a separate mirror site. Repositories on personal GitHub accounts are named, not linked: search GitHub for the name. Traffic figures are estimates unless a site publishes them.

## Summary

- **You already have a followed link you didn't know about.** LibHunt has a page for the goodwatch-monorepo repo (https://www.libhunt.com/r/goodwatch-monorepo). It links `https://goodwatch.app/` with no `rel` and no robots `noindex`. LibHunt grows the page from Reddit, HN, and dev.to mentions of the repo, so every technical article should link the repo as well as the site.
- **The best data move is the study itself, not a portal.** The study page already serves valid-looking `Dataset` JSON-LD with both CSV files as `DataDownload` entries. Google Dataset Search will pick it up only when the post leaves draft: the page is `noindex, nofollow` today. A Zenodo deposit of the country-level file adds a DOI and a followed link from a domain at Tranco rank 3,671 (`rel="noopener"` on description links), for about an hour.
- **Release country-level counts only, and fix the license line.** TMDB's license is "non-sublicensable", caching is capped at 6 months, and TMDB counts "collecting data sets containing TMDB Content" for ML training as commercial. The title-level CSV holds TMDB titles, IDs, and years for 5,400 titles picked by IMDb vote count, yet the page labels it CC BY 4.0. Keep it off portals. Never use Hugging Face. Never put IMDb, RT, or Metacritic values in any file (round 1 rule 18). IMDb has enforced this against Kaggle before.
- **Don't archive the monorepo on Zenodo.** The GitHub-to-Zenodo integration keeps every release forever, and the repo on main holds 163 CSV and JSONL files, including TV Tropes repair results and production metadata backups.
- **Awesome lists: five fit, all nofollow.** public-apis (490,985 stars) has an "MCP Servers" table that merges hosted OAuth servers. awesome-useful-websites has a "Movies and Series" section next to JustWatch and Reelgood. awesome-no-login-web-apps, TensorBlock's awesome-mcp-servers, and the new awesome-mcp-apps list also fit. Several lists reject AI-written PRs (awesome-useful-websites, awesome-tailwindcss), so you write each PR by hand.
- **Two quick followed links from galleries:** OGimage.gallery (5 minutes, followed) and Made with React.js (20 minutes, a 302 redirect through its own domain). Tailwind, Remix, React Router, Coolify, Valkey, Windmill, Satori, and PostHog have no open showcase.
- **The repo's GitHub page undersells the product.** The description is "GoodWatch is a unique take on discovering movies and shows", the README doesn't mention the MCP server or the study, there is no social preview image, and one topic is `dna`, which the product no longer calls it. Fixing this takes about 1.5 hours and comes before any list PR.
- **Anthropic's "Submit your build" spotlight** is the only showcase that reaches consumers, but its form grants a "perpetual, and irrevocable license" and asks you to flag third-party assets. Hold it until the TMDB position is settled.

## 1. Awesome lists

Merge rate is merged PRs among the most recent closed PRs (`gh api repos/<owner>/<repo>/pulls?state=closed&per_page=50`). Stars and last push are from 2026-10-21. All README links are nofollow. Cost is free for every list. Expected referral value is low for all of them (developer audiences, estimate), except where noted.

### Lists that fit

| List (search GitHub by name) | Owner type | Stars | Last push | Section that fits | Rules (from CONTRIBUTING or README) | Merge rate | AI-written PR policy | Owner effort | Risk | Fit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| public-apis | Org | 490,985 | 2026-10-21 | "MCP Servers" table. Hosted OAuth servers are listed (Openpath, ShapelessAI, Master Setter, and Refnusa were merged 2026-10-17 to 10-19) | One link per PR, title "Add X", description of 100 characters or less, must have a free tier, "not a marketing tool". "**Only link to listings that exist.** A link to a marketplace page that 404s will get the pull request closed" | 35/50 (2026-10-12 to 10-19); 100+ open | None stated | 30 min | Low | Medium; very large developer reach | **Do**, once a Glama or Claude directory link is live |
| awesome-useful-websites | Personal | 1,297 | 2026-05-28 | "Movies and Series" (JustWatch, Reelgood, A Good Movie to Watch, and Movie Map already listed) | "Do not add a website if it is merely for entertainment and not really useful". No duplicates | 14/50; merged in batches, newest batch 2026-05-28 | "If you are a spam/AI account, your pull request is going to be rejected." | 20 min | Low | **High**: consumer readers, the right neighbours | **Do** (slow) |
| awesome-no-login-web-apps | Personal | 3,401 | 2026-09-25 | Miscellaneous | "Do not add an app that requires an account to use its core features. An optional account for saving history is fine". The description must state the main features and a major shortcoming | 20/50 (sweep on 2026-09-24 and 25) | None stated | 20 min | Low | Medium to high: scores and "where to stream" work without an account | **Do** |
| awesome-mcp-servers (TensorBlock's) | Org | 931 | 2026-10-21 | `docs/art-culture--media.md` (an IMDb MCP server is already there) | One bullet in the category page, or an issue form from which a bot drafts the PR | 45/50, merged the same day | None stated | 15 min | Low | Medium | **Do** |
| awesome-mcp-apps | Personal | 1 (created 2026-10-05) | 2026-10-21 | "Open-source apps" (Excalidraw MCP, Mapbox, draw.io) | Needs 10+ stars, maintained, docs. One line of 100 characters or less, "No marketing words, no star counts, no emoji, no em dashes." Bot checks | 0/0 | None stated | 10 min | Low | High topically (the poster-grid MCP App), tiny reach | **Do** |
| awesome-public-datasets (entries live in the apd-core repo, 412 stars) | Org | 79,657 | 2026-10-20 | "Entertainment" (small Zenodo and GitHub datasets accepted) | YAML entry in apd-core. "No advertisement! No Spam! No reputation promotion!" Entries must "point directly at that `repository` rather than the page that `uses` the datasets". Downloadable without login | apd-core 37/50 | None | 30 min | Low | Medium, and only with a releasable dataset. The link would point at the Zenodo record, not goodwatch.app | **Later**, after the Zenodo deposit |
| awesome-mongodb | Personal | 2,679 | 2026-10-19 | "Applications": "open-source applications have MongoDB somewhere in their stack" | Standard format, alphabetical, one PR per item | 42/50 | None | 15 min | Low | Low to medium (MongoDB is only in the pipeline) | Maybe |
| awesome-open-source-saas-alternatives | Personal | 3,416 | 2026-10-19 | A new "Trakt" or "Letterboxd" section | Issue form, then a bot opens the PR. "The SaaS app being replaced must be a paid (or freemium) product." Description of 160 characters or less | 37/50 | None | 20 min | Low | Medium (the framing is a stretch) | Maybe. Its mirror on muapi.ai has followed links, but they point to the GitHub repo |
| awesome-remote-mcp-servers (a second list by another maintainer, not round 1's) | Personal | 1,155 | 2026-09-24 | "Other" | "Servers that are maintained by their underlying companies are preferred". OAuth required | 0/50 (2 of the last 200); the maintainer adds big companies by commit | None | 15 min | Low | Medium, very low odds | Optional. Its mirror remote-mcp.com has followed links (checked on two server pages) |
| awesome-chatgpt-apps (mirror of the ChatGPT directory) | Personal | 16 | 2026-07-02 | "Entertainment" (two movie apps already there) | Only apps live in the ChatGPT directory | 0/2 | None | 10 min | Low | Medium | After the ChatGPT listing is live |

### Lists checked and not recommended

| List | Stars | Why not |
| --- | --- | --- |
| awesome-react | 74,999 | "Kindly refrain from using this list as an advertisement board". 5/50 merged |
| awesome-nodejs (the large one) | 67,195 | Packages only, "at least 100 stars" |
| awesome-nodejs-projects (an org list) | 5,589 | Last merge 2021-04-11 |
| awesome-tailwindcss (org) | 15,207 | No showcase section, and "Pull requests that are written, generated, drafted, or assembled by large language models ... are **not accepted**" |
| better-auth's awesome list (org) | 394 | "Projects" needs more than 1,000 stars; last push 2025-07-17 |
| awesome-dataviz (org) | 4,437 | Libraries whose "main purpose" is data visualization only |
| awesome-datajournalism (org) | 240 | Handbooks and tools; low activity |
| awesome-pwa | 4,937 | Requires a service worker and offline support, which GoodWatch lacks. A competitor (MoodMovie) is listed |
| awesome-jellyfin (org) | 9,657 | Jellyfin-integrated projects only |
| awesome-free-apps | 7,939 | Desktop and mobile apps only |
| awesome-oss-alternatives (Runa Capital) | 19,771 | Needs a "private for-profit company" and 100+ stars; no merges in 2026 |
| OpenAlternative's README list | 6,830 | Generated from openalternative.co; PRs closed (see section 2) |
| awesome-opensource-apps | 3,937 | README overwritten by an unrelated list |
| public-apis (the second list, behind publicapis.dev) | 9,605 | "Apps ... and websites with no connectable API do not belong here"; site links are `nofollow ugc` |
| awesome-entertainment | 255 | Lists pirate streaming sites, a bad neighbourhood |
| awesome-smart-tv, awesome-stremio, awesome-home-media-center, awesome-ad-free | 1,440 / 803 / 67 / 519 | Stale (last merges 2018 to 2022) or developer resources only |
| Film-content lists (movies-for-hackers 11,959, awesome-IT-films, awesome-scifi) | various | They list films, not tools |
| awesome-ai-apps (large) | 16,437 | Code projects inside the repo only |
| Awesome-MCP-ZH, the MindPal hosted-MCP list, awesome-mcp-list, another Awesome-MCP-Servers | 7,751 / 73 / 895 / 1,075 | Chinese-language audience, low merge rates (1/50 to 18/50), or repo-only rules |
| mcpHQ's awesome-mcp-servers (org) | 194 | 49/50 merged and it invites AI agents to "insert your entry at a random position", so it is barely curated. Its mcphq.org pages are followed, but it reads as a low-quality directory |
| Qdrant community resources | 23 | Tiny reach (optional) |

No awesome lists exist for CrateDB, Windmill, PostHog, Satori, resvg, or Coolify. The Coolify and Tailscale lists found were tiny or stale.

## 2. Open-source alternative directories

| Directory | Cost | Owner effort | Link type (listing checked) | Expected referral value | Risk | Fit | Rules URL | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LibHunt | Free | 0 (the page exists) | **Followed**: the goodwatch.app link on its goodwatch-monorepo page has no `rel`, and the page has no robots meta. Jellyfin's page is the same | Low, developers. Tranco 63,399 | Very low | Medium | https://www.libhunt.com/repo/submit | **Already there.** The page was created from a 2024-05-05 post about building GoodWatch. Link the repo in future articles so the page stays active |
| AlternativeTo, open-source license filter | Free | 10 min, once the round 1 listing is live | Same as round 1 | The filtered views are short: "open source alternatives to Letterboxd" lists 20 apps and JustWatch 14. GoodWatch is in neither | Low | High | Set the license to Open Source (MIT) and add the repo link on the listing | **Do** |
| OpenAlternative | Free queue ("Free listings go live one per weekday, so the wait can be a few months"); $97 Standard (nofollow); $137 Premium ("do-follow backlink"); $197 a month Ultimate | 20 to 30 min | **Nofollow** on free and Standard. The site says "Free and Standard listings link to your site with rel="nofollow"", and Plausible's page has `rel="noopener nofollow"` | Medium. Self-reported 220K visitors a month. Tranco 363,342 | Low on the free tier. The paid "do-follow" tiers are paid links under Google's spam policy | Medium. It lists "Full applications people can run" and excludes "MCP servers and thin AI wrappers". Its Media & Streaming category has 11 entries (Jellyfin, Kodi, Invidious, PeerTube, and others) and no movie-discovery app. Minimum star count (not verified) | https://openalternative.co/submit | **Maybe, free tier only.** Name Letterboxd or JustWatch as the proprietary rival |
| OpenSourceAlternative.to | Free waitlist "(6+ months)" or $29 | 15 min | Followed (`noopener noreferrer`, Godot listing) | Low. Tranco 1,060,278 | Low | **Ineligible**: "The project is self-hosted" | https://opensourcealternative.to/submit | Skip |
| opensource.builders | n/a | n/a | n/a | Very low. Tranco 2,528,065 | n/a | No: it catalogues features for builders, and `/submit` returns 404 | https://opensource.builders/ethos | Skip |
| Awesome Open Source (awesomeopensource.com) | n/a | n/a | Nofollow (Jellyfin page) | Low. Tranco 205,964 | n/a | No submission path; data looks stale (2024 dates) | none found | Skip |
| osssoftware.org | Plans of $299, $999, and $2,999 | n/a | Followed (Caddy page) | Unknown; not in Tranco | **Link-farm signs**: paid plans, a "GPT URL" field, part of a directory network | Low | https://osssoftware.org/ | Skip |
| European alternatives sites | Free (not verified) | n/a | (not verified) | Low; european-alternatives.eu is Tranco 151,898 | Low | Needs an EU operator and a US rival; category fit (not verified) | (not verified) | Skip unless you want the EU angle |
| selfh.st, OSS Insight, GitHub Open Source Friday | n/a | n/a | n/a | n/a | n/a | selfh.st is self-hosted only; OSS Insight is passive analytics; Open Source Friday is about contributing | n/a | Skip |

## 3. GitHub-side discoverability and vendor showcases

### The repo's own GitHub page

Read with `gh api` on 2026-10-21: personal account, 41 stars, 5 forks, MIT, homepage `https://goodwatch.app/`, no custom social preview (`usesCustomOpenGraphImage: false`), Discussions off. Description: "GoodWatch is a unique take on discovering movies and shows." Topics (15): aggregation, ai, discovery, disneyplus, dna, explore, imdb, metacritic, movies, netflix, prime, recommendation-engine, rotten-tomatoes, streaming, tv. The README on main still leads with "GoodWatch is alive and running", says nothing about the MCP server, the blog, or imports, and calls its setup guide outdated.

Link type: the repo homepage link renders as `rel="noopener noreferrer nofollow"` (checked on the react-router repo page), and README links are nofollow. These changes bring developer visitors and make list reviewers say yes. They pass no ranking signal.

| Change | Cost | Owner effort | Link type | Expected value | Risk | Fit | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rewrite the description in plain words, for example: "Movie and TV discovery: IMDb, Rotten Tomatoes and Metacritic in one score, where it streams in 139 countries, and a remote MCP server for Claude and ChatGPT." | Free | 5 min | Nofollow | GitHub search and topic pages match on description text | None | High | Do |
| Replace weak topics (`dna`, `explore`, `aggregation`, `prime`) with small topics where a 41-star repo lands on the first page sorted by stars: `remote-mcp-server` (130 repos, 4 with more stars), `mcp-apps` (325, 23), `windmill` (41, 1), `cratedb` (100, 6), `justwatch` (54, 5), `streaming-availability` (7, 1), `letterboxd` (447, 27), `movie-recommendation` (896, 25). Stay within GitHub's 20-topic limit | Free | 10 min | Nofollow | Small, steady developer discovery. Topic pages rank in Google for "<topic> github" searches (estimate) | None | High | Do. Dropping `dna` also follows the "title analysis" naming rule |
| Upload a social preview image (1280x640) | Free | 15 min | n/a | Better cards when the repo is shared on Bluesky, X, Discord, and Slack | None | Medium | Do; reuse an existing OG card style |
| Refresh the README top: what GoodWatch does today, links to `/use-with-ai` and the study, and fix or drop the "outdated guide" note | Free | 1 h | Nofollow | Visitors from lists and LibHunt judge the project by it, and so do list reviewers | None | High | Do before any list PR |
| Add `CITATION.cff` | Free | 15 min | n/a | GitHub shows "Cite this repository". Useful only if researchers cite the study | None | Low | Optional |
| GitHub Trending and Explore | Free | n/a | Nofollow | Trending follows recent star velocity; there is no submission path | None | Low | Nothing to do directly |

### Vendor "built with" programs

What GoodWatch uses, from the `package.json` files on main: Remix 2.17, React 18, Tailwind 4, satori 0.33.5 and resvg, Qdrant clients, CrateDB (`node-crate`), Better Auth 1.7.7 (`packages/auth-stack`), PostHog, and ioredis against Valkey. MongoDB and Windmill run in the data pipeline only.

| Vendor | What exists | Cost | Owner effort | Link type (checked) | Expected value | Risk | Fit | URL | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Better Auth community adapters page | GoodWatch has a CrateDB adapter (`app/server/auth/crate-adapter.server.ts`) with a conformance suite. The docs say "open a pull request to add it to this list". 8 of the last 9 adapter PRs were merged (June to October 2026) | Free | 1 to 2 days to publish an npm package and README, then a 15-minute PR | Followed (`noopener noreferrer`), but to the package's GitHub repo, not goodwatch.app | Low referral; developer goodwill | Low; you take on a maintained package | Medium | https://better-auth.com/docs/adapters/community-adapters | Maybe, if you want an open-source piece |
| CrateDB integrations guide | Docs repo that merges outside PRs | Free | Half a day, after the adapter package exists | (not verified; links render with JavaScript) | Very low | Low | Low | https://cratedb.com/docs/guide/integrate/ | Later |
| MongoDB forum, "Building on MongoDB" | 21 topics | Free | 30 min | `noopener nofollow ugc` (topic 341998) | Very low | Low | Low | https://www.mongodb.com/community/forums/c/building-on-mongodb | Skip |
| Qdrant blog case studies | 54 case studies, staff-written, some small startups | Free | 2 to 4 h of pitching and interviews | `noopener nofollow` (a 2026-08-13 case study) | Low | Low | Low to medium | https://qdrant.tech/blog/ | Skip for links |
| Tailwind showcase | 57 staff-curated entries; outside PRs closed | n/a | n/a | Followed (`noopener noreferrer`) | n/a | n/a | No submission path | https://tailwindcss.com/showcase | Skip |
| Remix and React Router | v2.remix.run/showcase still empty; reactrouter.com/showcase returns 404; "Show and tell" discussions get about 1 upvote | Free | 30 min | Nofollow (GitHub) | Very low | Low | Low | https://github.com/remix-run/react-router/discussions | Skip |
| Windmill, Coolify, Valkey, PostHog, Tailscale, Satori and Vercel OG | Enterprise case studies only, or nothing (coolify.io/showcase and valkey.io/users return 404) | n/a | n/a | n/a | None | n/a | n/a | https://www.windmill.dev/case-studies | Skip |

## 4. Dataset portals and what the study data may be released as

### Current state

The study is a draft (posts.json `"draft": true`), and the live page is `noindex, nofollow`. Both CSV files are already public at `/downloads/streaming-by-country-2026/` (HTTP 200, no `X-Robots-Tag`). The page credits "This product uses the TMDB API but is not endorsed or certified by TMDB", "Streaming data from JustWatch, through TMDB", and the IMDb courtesy line, and says "both CC BY 4.0".

| File | Rows | Columns | Third-party content inside |
| --- | --- | --- | --- |
| `goodwatch-streaming-by-country-2026.csv` | 139 countries | Title counts per access type (subscription, free with ads, library card, rent or buy), the biggest service's name and count, Netflix counts, Netflix catalogue totals, `best_rated_1000_on_subscription`, snapshot date | Service names, and counts computed from TMDB watch-provider data (JustWatch). `best_rated_1000` depends on the GoodWatch score, which uses IMDb, RT, and Metacritic, but the file holds only a count |
| `goodwatch-streaming-by-title-2026.csv` | 5,400 titles | `tmdb_id`, type, title, year, number of countries per access type, snapshot date | TMDB content (IDs, titles, years) for every row. The title set is "every movie and show ... with at least 50,000 IMDb votes", so IMDb data picks the list, although no IMDb value is in the file |

### What the terms say

| Source | Clause (quoted) | What it means for a release |
| --- | --- | --- |
| TMDB API terms, 1.A (last updated 2023-10-20) | The license is "non-exclusive, non-transferable, non-sublicensable" | GoodWatch can't license TMDB content to anyone. "Both CC BY 4.0" covers the title file, which holds TMDB titles, IDs, and years. GoodWatch can license only its own counts |
| TMDB 1.C | You may not "Cache, for longer than 6 months, any information obtained through or from TMDB", "Make derivatives of the TMDB APIs or TMDB Content", or "Sell, lease, or sublicense ... TMDB Content" | A permanent archive of TMDB content conflicts with the 6-month limit. Read broadly, even counts are "derivatives". You already chose to go ahead despite TMDB risk, and a count table adds little exposure beyond the page |
| TMDB 1.D | On termination you "must promptly delete or otherwise purge all TMDB Content, including any cached content" | You can't purge copies on portals that don't delete. Keep TMDB content off them |
| TMDB 2.A | Commercial use includes "Training or validating a machine learning or artificial intelligence system" and "collecting data sets containing TMDB Content for such training or validation" | Hugging Face, and to a lesser degree Kaggle, are ML hubs. Publishing TMDB-derived data there invites the use TMDB calls commercial |
| TMDB 3 | Use the TMDB logo, less prominent than your own, and say the product "uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB" | Put the notice in every portal description and in a README inside each upload |
| TMDB watch-provider endpoint docs | "In order to use this data you must attribute the source of the data as **JustWatch**." "If we find any usage not complying with these terms we will revoke access to the API." | Every release says "Streaming availability data from JustWatch, through TMDB" |
| JustWatch terms of use (support.justwatch.com, no date shown) | Users may not "reproduce, display, publicly perform, or otherwise use the Service Content in any way for any public or commercial purpose", "distribute or create derivative works", or use "data mining, robots, scraping" | These cover the justwatch.com website, not data received through TMDB. Never publish anything read on justwatch.com itself as data, such as the hand checks in `docs/launch/streaming-study/hand-checks.md`. No separate JustWatch logo or wording rule was found |
| IMDb help, "Can I use IMDb data in my software?" | The data "must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information (except for individual personal use)". Credit: "Information courtesy of IMDb (https://www.imdb.com). Used with permission." | Round 1 rule 18 stands. A 5,400-row title list picked by IMDb votes is close to a "repurposed ... database of movie information". IMDb has enforced this on a portal: Kaggle removed its IMDb-based 5000-movie dataset after a DMCA request from IMDb and replaced it with TMDB data (Kaggle's notice, read through a repost) |

This is not legal advice.

### What can be released, and where

| Data | On goodwatch.app | On dataset portals | Credits |
| --- | --- | --- | --- |
| Country-level counts (139 rows) | Yes (already live) | **Yes, as the only file.** GoodWatch's own aggregate counts, no title list, no IMDb values | TMDB notice (and logo where the portal allows images), "Streaming availability data from JustWatch, through TMDB", and "Title selection uses IMDb vote counts. Information courtesy of IMDb (https://www.imdb.com). Used with permission." |
| Title-level counts (5,400 rows) | Owner decision (already live) | **No.** TMDB content plus an IMDb-picked list. Permanent archives and ML hubs make both problems worse | Same |
| Any IMDb, RT, or Metacritic value, or the GoodWatch score per title | No | No | n/a |
| Raw watch-provider snapshot (provider per title and country) | No. The study script already keeps it outside the repo for the 6-month rule | No | n/a |

Suggested license wording for the country file: "Counts compiled by GoodWatch: CC BY 4.0. Service names and the underlying availability data belong to their owners (JustWatch, through TMDB) and are not covered by this license." For the title file, if you keep it: "Counts compiled by GoodWatch: CC BY 4.0. Titles, years, and TMDB IDs are TMDB content under TMDB's terms."

### Portals

| Portal | Cost | Owner effort | Link type (checked where) | Audience and expected referral value | Risk | Fit | Rules URL | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Google Dataset Search** (schema.org `Dataset` on the study page) | Free | 0 now; 30 min for the additions below | Not a backlink: results link to the study page | Researchers, students, journalists. Low volume, well targeted (estimate) | None | High | https://developers.google.com/search/docs/appearance/structured-data/dataset | **Do.** The markup is live; it starts working when the post is published |
| **Zenodo**, country CSV only, with a DOI | Free; 50 GB per record | 1 h | **Followed.** Description links had `rel="noopener"` only (record 10440001); related-identifier links had no `rel` (record 8437424). Tranco 3,671. Dataset records carry schema.org `Dataset` JSON-LD | Academics and data people; the DOI feeds DataCite, OpenAIRE, and Google Dataset Search. Few visits, strong citation value (estimate) | Low for counts. Records are kept "for the lifetime of the repository", and "Withdrawal is considered an exceptional action", so never deposit TMDB content. "Content not considered to fall under the scope of the repository will be removed" | Medium to high | https://about.zenodo.org/policies/ | **Do, country file only** |
| Zenodo GitHub integration (DOI per repo release) | Free | 30 min | Followed (same pages) | Developers who cite software | **High**: it archives the whole release forever, and the monorepo holds 163 CSV and JSONL files, including TV Tropes results and production metadata backups | Low | https://docs.github.com/en/repositories/archiving-a-github-repository/referencing-and-citing-content | **Skip** for the monorepo. Only for a small extracted repo with no third-party data |
| Kaggle Datasets, country CSV only | Free | 1 to 1.5 h (card, cover, column notes) | (not verified): descriptions render with JavaScript, so links aren't in the served HTML. The served page is `index, follow` with `Dataset` JSON-LD. Tranco 4,455 | Data-science learners. Netflix datasets are among Kaggle's most used, and Kaggle pages rank for "netflix dataset" searches (estimate). Medium visits if notebooks use it | Low to medium: an ML audience (TMDB 2.A). Kaggle already hosts TMDB datasets, including its own TMDB 5000 | Medium | https://www.kaggle.com/docs/datasets (renders with JavaScript; rules not verified) | Maybe, after Zenodo |
| Hugging Face datasets | Free | 1 h | **Nofollow** on dataset card links (checked on the stanfordnlp/imdb card) and on profile website links (checked on the allenai profile). Tranco 1,113 | ML practitioners | Medium to high: an ML training hub, which TMDB 2.A names as commercial | Low | https://huggingface.co/docs/hub/datasets-cards | **Skip** |
| Figshare | Free (individual) | 1 h | (not verified): item pages returned HTTP 202 with an empty body (bot check). Tranco 13,019 | Academics | Low for counts | Low to medium | https://info.figshare.com/user-guide/ (not verified) | Skip; Zenodo covers the same audience with a checked link |
| OSF | Free | 1 h | (not verified): pages render with JavaScript. Tranco 5,940 | Researchers | Low | Low | https://help.osf.io/ (not verified) | Skip |
| Harvard Dataverse | Free | 1 h | (not verified): HTTP 202 bot check | Researchers | Low | Low | https://support.dataverse.harvard.edu/ (not verified) | Skip |
| data.world | n/a | n/a | n/a | n/a | n/a | n/a | https://data.world/community/goodbye/ | **Closed**: "The data.world Open Data Community officially retired on July 13, 2026" |
| Data.gov, data.europa.eu | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Ineligible: public-sector data only |
| Data Is Plural (dataset newsletter) | Free | 20 min | **Followed** in the web archive (2025-08-27 edition) | Data journalists, a strong fit | Low | Medium | https://www.data-is-plural.com/ | **Dormant**: 400 editions, newest 2025-08-27. Check for a new edition before suggesting the dataset |

### The Dataset markup on goodwatch.app

The study page serves `BlogPosting`, `Dataset`, and `BreadcrumbList` JSON-LD (live HTML, 2026-10-21). The `Dataset` node has `name`, a `description` well inside Google's 50 to 5,000 character range, `url`, a version-specific `license`, `isAccessibleForFree`, `temporalCoverage`, `spatialCoverage`, `creator`, `publisher`, `isBasedOn` (TMDB watch providers, JustWatch), and two `DataDownload` entries with `contentUrl` and `encodingFormat`. That covers Google's required properties. Google's page was last updated 2026-09-08.

1. **It can't be indexed yet.** Google says the page must not be "blocked by a robots.txt file, the `noindex` tag, or login requirements". The page is `noindex, nofollow` as a draft, and `/blog` isn't in the sitemap index. Both change when the post is published.
2. **Narrow the license claim** in the markup to match the wording above, or drop the title file from `distribution`.
3. **Add `identifier` (the DOI) and `sameAs` (the Zenodo record)** once the deposit exists. Google recommends both, and they tie the two copies together.
4. **Add `variableMeasured`** with the column names and `measurementTechnique` ("TMDB watch providers, read once per title and country"). Both are recommended and "pending standardization".
5. After publishing, run the Rich Results Test and URL Inspection on the study URL.

## 5. Framework, gallery, and AI showcases

| Item | Cost | Owner effort | Link type (checked) | Expected referral value | Risk | Fit | Rules URL | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **OGimage.gallery** | Free (URL plus optional handle) | 5 min | **Followed** (`target="_blank"`, no `rel`, on gallery entries) | Low, designers. Not in Tranco. Newest entry 2026-02-09 | Very low | Medium: GoodWatch's 1200x630 title cards fit | https://www.ogimage.gallery/submit | **Do** |
| **Made with React.js** | Free; review "about 6-8 weeks" | 20 min | The website link goes through a `/go/<slug>` 302 redirect on its own domain, then to the site with `?ref=madewithreactjs.com` (no `rel`). Entries are reshared on X and Bluesky | Low. Not in Tranco | Low | Medium (#WebApps) | https://madewithreactjs.com/submit | **Do** |
| **Anthropic "Submit your build"** (Claude community spotlight, help article dated 2026-06-12) | Free | 30 to 45 min | Features appear on Anthropic's social channels, newsletters, and website. Anthropic aims to credit builders, but "Credit placement varies" and a link to your site is not promised (not verified) | High reach if picked, and on target (Claude users). Low odds (estimate) | You grant a "non-exclusive, royalty-free, worldwide, perpetual, and irrevocable license", must have "the rights to all included material", and must "tell us about any third-party assets" (TMDB posters and data) | High | https://support.claude.com/en/articles/15485501-submit-your-build-how-it-works-and-what-you-re-agreeing-to (form linked from https://claude.com/community) | **Do, after the TMDB decision** |
| StackShare | Free (not verified) | 30 min | (not verified): Vercel checkpoint, HTTP 429 | Low. Tranco 46,918 | Low | Low to medium | https://stackshare.io | Maybe |
| builtwithreact.io | (not verified): HTTP 403 | n/a | n/a | n/a | n/a | n/a | n/a | Skip |
| MCP ext-apps examples, MCP blog | Official examples and maintainer posts only | n/a | n/a | n/a | n/a | No community path | modelcontextprotocol/ext-apps README | Skip |
| a2ui.me (MCP Apps directory) | No submit path | n/a | Followed, but to GitHub repos | Very low | n/a | Low | https://a2ui.me | Skip |
| OpenAI community forum (Apps SDK) | A support forum | n/a | Discourse, likely `nofollow ugc` (verified on MongoDB's Discourse, not OpenAI's) | Low | Off-topic promotion | Low | https://community.openai.com/c/chatgpt-apps-sdk | Skip |

## Recommended moves

Ranked by value per owner hour. Followed links that take minutes come first. Then come the changes that make later list PRs succeed, and then nofollow lists, ranked by audience fit.

| Rank | Move | Owner hours | Link type | Why it ranks here |
| --- | --- | --- | --- | --- |
| 1 | **Submit a title card to OGimage.gallery** | 0.1 | Followed | Five minutes for a followed link, with no review risk |
| 2 | **Set the AlternativeTo listing's license to Open Source (MIT)** and add the repo link | 0.2 | Same as round 1 | Moves GoodWatch from crowded views into short filtered lists of 14 to 20 apps for JustWatch and Letterboxd |
| 3 | **When the study leaves draft:** fix the license line on the page and in the markup, deposit the country CSV on Zenodo, then add the DOI as `identifier` and `sameAs` | 1.5 | Followed (Zenodo) plus a Google Dataset Search entry | The strongest followed link in this channel (Tranco 3,671), a permanent DOI writers and researchers can cite, and the Dataset Search entry Google's markup is built for |
| 4 | **Refresh the GitHub page**: description, topics (drop `dna`), social preview, README top | 1.5 | Nofollow | Every list reviewer, LibHunt visitor, and awesome-list reader lands here. A stale README lowers every PR's odds |
| 5 | **Submit to Made with React.js** | 0.3 | Redirect, no `rel` | Cheap, plus social reshares |
| 6 | **public-apis "MCP Servers" row**, once a Glama or Claude directory link is live | 0.5 | Nofollow | The largest audience here, and it merges hosted OAuth servers within days |
| 7 | **awesome-useful-websites ("Movies and Series") and awesome-no-login-web-apps**, written by hand | 0.6 | Nofollow | Consumer readers and the right neighbours (JustWatch, Reelgood). Merges are slow and batched |
| 8 | **TensorBlock's awesome-mcp-servers and awesome-mcp-apps** | 0.5 | Nofollow | Fast merges and an exact fit for the poster-grid MCP App; small reach |
| 9 | **Anthropic "Submit your build"**, after the TMDB decision | 0.75 | Not verified | Consumer reach among Claude users. The license and rights confirmations need a decision first |
| 10 | **OpenAlternative, free tier** | 0.5 | Nofollow | Real traffic (220K a month, self-reported) and a Media & Streaming category with no discovery app. The queue takes months |
| 11 | **awesome-public-datasets Entertainment entry**, pointing at the Zenodo record | 0.5 | Nofollow (to Zenodo) | Only after move 3. Brings data people to the record, which links back with a followed link |
| 12 | **Kaggle, country CSV only** | 1.5 | Not verified | Kaggle's Netflix datasets draw many learners, but the link type is unknown and the audience leans ML |

Keep LibHunt in mind with every technical article: link the GitHub repo as well as goodwatch.app, and the followed LibHunt page stays active.

## Skip list

| Item | Reason |
| --- | --- |
| Hugging Face datasets | Nofollow, and an ML training hub, which TMDB 2.A calls commercial use |
| Zenodo GitHub integration for the monorepo | Archives every release forever, including third-party data files in `docs/` |
| Title-level CSV on any portal | TMDB content plus an IMDb-picked list; can't be licensed or purged |
| data.world | Community retired on 2026-07-13 |
| Figshare, OSF, Harvard Dataverse | Same audience as Zenodo, link types not verified |
| OpenAlternative Premium and Ultimate, osssoftware.org, any paid "do-follow" tier | Paid links under Google's link spam policy; osssoftware.org also shows link-farm signs |
| OpenSourceAlternative.to, selfh.st, awesome-selfhosted | Self-hosted software only |
| awesome-tailwindcss | Bans LLM-assisted PRs and has no showcase section |
| awesome-react, awesome-nodejs, awesome-free-apps, awesome-ai-apps, awesome-dataviz | No section for a hosted app, or a stars bar GoodWatch doesn't meet |
| better-auth's awesome list | 1,000-star bar, unmaintained |
| awesome-pwa | Requires a service worker |
| awesome-jellyfin | Jellyfin integrations only |
| awesome-entertainment | Lists pirate streaming sites |
| mcpHQ's list and mcphq.org | Barely curated (49/50 merged, invites AI agents) |
| Tailwind, Remix, React Router, Coolify, Valkey, Windmill, PostHog, Tailscale, Satori showcases | No open submission path, or the path is dead |
| MongoDB forum, Qdrant case studies | Nofollow, low fit |
| Awesome Open Source, opensource.builders | No submission path |

## Owner decisions this channel raises

1. **The title-level CSV.** Keep it on goodwatch.app with corrected license wording, strip it to `tmdb_id` plus counts, or remove it? It is live today and labelled CC BY 4.0.
2. **A permanent Zenodo deposit** of the country counts. Records can't normally be withdrawn, so this is a one-way step.
3. **Anthropic's spotlight terms**: a perpetual, irrevocable license plus confirmations that you hold the rights to everything shown.
4. **Third-party data files in the public repo** (TV Tropes repair results, production metadata backups). They block a Zenodo software DOI, and they are an exposure on their own. This channel didn't assess them further.
5. **A public Better Auth CrateDB adapter package**, if you want an open-source piece to maintain.

## Sources

All accessed 2026-10-21.

Terms and data rules:

- https://www.themoviedb.org/api-terms-of-use
- https://developer.themoviedb.org/docs/faq
- https://developer.themoviedb.org/reference/movie-watch-providers
- https://support.justwatch.com/article/just-watchs-terms-of-use
- https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX
- https://data.imdb.com/non-commercial-datasets/
- Kaggle's TMDB 5000 transfer notice, read through a repost at https://www.finclip.com/news/f/6791.html (secondary)

Google:

- https://developers.google.com/search/docs/appearance/structured-data/dataset (last updated 2026-09-08)

Dataset portals:

- https://about.zenodo.org/policies/
- https://zenodo.org/records/10440001
- https://zenodo.org/records/8437424
- https://zenodo.org/robots.txt
- https://huggingface.co/datasets/stanfordnlp/imdb
- https://huggingface.co/allenai
- A popular Kaggle Netflix titles dataset page (served HTML; URL left out because it contains a personal account name)
- https://www.kaggle.com/robots.txt
- https://data.world/community/goodbye/
- https://www.data-is-plural.com/
- https://www.data-is-plural.com/archive/2025-08-27-edition/
- https://api.figshare.com/v2/articles/search
- https://dataverse.harvard.edu/api/search
- Tranco ranks from https://tranco-list.eu/api/ranks/domain/<domain>

GoodWatch:

- https://goodwatch.app/blog/streaming-by-country-2026 (live HTML and JSON-LD)
- https://goodwatch.app/robots.txt
- https://goodwatch.app/sitemaps/sitemap.xml
- https://goodwatch.app/downloads/streaming-by-country-2026/ (both CSV files)
- Repo files: `goodwatch-webapp/app/content/blog/streaming-by-country-2026/` (data.json, post.mdx, sources.md), `goodwatch-webapp/scripts/streaming_study.py`, `goodwatch-webapp/public/downloads/streaming-by-country-2026/`, `README.md` and `package.json` files on main
- Repo metadata through `gh api repos/...` and GraphQL (`usesCustomOpenGraphImage`)

GitHub:

- https://github.com/remix-run/react-router (homepage link `rel`)
- Topic counts through `gh api search/repositories?q=topic:<topic>`
- For each awesome list: README, CONTRIBUTING, and PR template, read through `gh api repos/<owner>/<repo>/...`, plus closed PRs through `gh api repos/<owner>/<repo>/pulls?state=closed&per_page=50`. Org lists include public-apis/public-apis and awesomedata/apd-core. The others are on personal accounts or are named above; search GitHub for their names.
- awesome-list mirror sites: https://www.remote-mcp.com/, https://mcphq.org/servers/ausca/, https://muapi.ai/open-source/alternatives, https://publicapis.dev/resource/bob-s-burgers-api/eibwtq6j

Directories and showcases:

- https://www.libhunt.com/r/goodwatch-monorepo
- https://www.libhunt.com/repo/submit
- https://www.libhunt.com/about
- https://alternativeto.net/software/letterboxd/?license=opensource
- https://alternativeto.net/software/justwatch/?license=opensource
- https://openalternative.co/submit
- https://openalternative.co/submit/zero
- https://openalternative.co/advertise
- https://openalternative.co/categories/misc/media-and-streaming
- https://opensourcealternative.to/submit
- https://opensource.builders/ethos
- https://awesomeopensource.com/project/jellyfin/jellyfin
- https://osssoftware.org/
- https://better-auth.com/docs/adapters/community-adapters
- https://cratedb.com/docs/guide/integrate/
- https://www.mongodb.com/community/forums/c/building-on-mongodb
- https://qdrant.tech/blog/
- https://www.windmill.dev/case-studies
- https://tailwindcss.com/showcase
- https://v2.remix.run/showcase
- https://reactrouter.com/showcase
- https://github.com/remix-run/react-router/discussions
- https://www.ogimage.gallery/submit
- https://madewithreactjs.com/submit
- https://claude.com/community
- https://support.claude.com/en/articles/15485501-submit-your-build-how-it-works-and-what-you-re-agreeing-to
- https://stackshare.io
- https://a2ui.me
- https://community.openai.com/c/chatgpt-apps-sdk

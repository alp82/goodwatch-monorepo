# GoodWatch listings kit

Prepared October 18, 2026, for the first listings in the backlinks plan ([`backlinks-research.md`](../research/discovery-search/backlinks-research.md), moves 1, 2, and 5). Everything here is ready for the owner to submit in one sitting, under the owner's own accounts.

Nothing was submitted, posted, or signed up for while preparing this kit. No DNS record was changed and no registry key was generated.

One repo change came with this kit: `goodwatch-webapp/public/site.webmanifest` had an empty `name` and `short_name`, so a phone that installed the site showed no name. It now says GoodWatch, with the site's dark theme color. The registry manifest needed no change.

## Contents

- [Order and time](#order-and-time)
- [Shared copy](#shared-copy): the text every listing reuses
- [Screenshots](#screenshots)
- [1. Official MCP Registry](#1-official-mcp-registry)
- [2. AlternativeTo](#2-alternativeto)
- [3. SaaSHub](#3-saashub)
- [4. Launching Next](#4-launching-next)
- [5. Tiny Startups](#5-tiny-startups)
- [6. Claude Connectors Directory](#6-claude-connectors-directory)
- [After submitting](#after-submitting)

## Order and time

| Step | What | Owner time | Waits on |
| --- | --- | --- | --- |
| 1 | Generate the registry key and add the DNS TXT record in Cloudflare | 10 min | Nothing |
| 2 | AlternativeTo: create and verify the account, suggest the app | 20 to 30 min | Nothing |
| 3 | SaaSHub: submit, then click the verification email sent to an `@goodwatch.app` address | 15 min | Nothing |
| 4 | Launching Next | 10 min | Nothing |
| 5 | Tiny Startups (the free route may ask for a verification post) | 10 to 15 min | Nothing |
| 6 | Registry login and publish (DNS has propagated by now) | 10 min | Step 1 |
| 7 | Claude directory: capture the carousel shots in Claude.ai, then fill the portal | 2 to 3 h | The TMDB decision, see [section 6](#6-claude-connectors-directory) |

Steps 1 to 6 take about 1.5 hours. Step 1 comes first so that the TXT record propagates while you do the listing sites.

The backlinks research lists an open owner question about TMDB's API terms (commercial use "in connection with ... chatbots"). The research suggests holding the Claude directory until you decide it. The registry and the four listing sites can go ahead either way.

## Shared copy

Use these blocks wherever a form asks for them. The facts come from the live start page, About page, and How it works page on October 18, 2026. Recheck the numbers (325 services, 139 countries, 1.5 million titles, 74 traits) if you submit much later.

Some sites reject links, emails, or phone numbers in descriptions (AlternativeTo does), so none of the descriptions contain any.

### Basics

| Field | Value |
| --- | --- |
| Name | GoodWatch |
| Website | `https://goodwatch.app` |
| Pricing | Free. No paid plan, no ads. A free account saves ratings, Wishlist, and progress; browsing needs no account. |
| License | Free. The source is public under the MIT license, so "Open Source" is also accurate where a site offers it. |
| Platforms | Web (any browser, desktop and phone). Installable on phones as a web app (PWA). Also works inside AI apps that support MCP (Claude, ChatGPT, Cursor, VS Code, and others). No native iOS or Android app. |
| Languages | English interface. Titles can show in other languages (Settings, "Show titles in"). |
| Countries | Worldwide; streaming availability covers 139 countries. |
| Launched | 2023 |
| Maker | Independent, one developer |
| Logo | `goodwatch-webapp/public/mcp-icons/goodwatch-512.png` (512 x 512 PNG). Smaller: `goodwatch-128.png` in the same folder. |
| Support page | `https://goodwatch.app/support` |
| Social and community | Discord, Reddit, GitHub, and Blog links are in the site footer. Copy them from there. |

### Taglines

| Length | Text | Characters |
| --- | --- | --- |
| Up to 60 | Find what to watch for your taste, and see where it streams | 59 |
| Up to 80 | Every score, every streaming service and picks for your taste, in one place | 75 |

### Short description (153 characters)

<!-- short-description:start -->
Free movie and TV show finder: one score from IMDb, Rotten Tomatoes, Metacritic and TMDB, where titles stream in 139 countries, and picks for your taste.
<!-- short-description:end -->

### Long description

<!-- long-description:start -->
GoodWatch helps you decide what to watch tonight. It brings the scores, the streaming services, and your own taste together, so you don't have to check several sites.

- One score: critics and audiences from IMDb, Rotten Tomatoes, Metacritic and TMDB, combined into one GoodWatch score for every movie and show.
- Where it streams: 325 streaming services in 139 countries. Pick your services and see what's on them tonight, and see when a title on your Wishlist arrives on one of them.
- Picks for your taste: rate a few titles you loved, and GoodWatch shows how well every other title fits you, and why.
- Search by feeling: every title is read on 74 traits, such as tense, heartwarming or funny. Type "a mind-blowing space adventure" and get the titles that fit.
- Discover: narrow 1.5 million titles down by your services, mood, genre, age rating and score, and hide what you've already seen.
- Tracking: a Wishlist, your ratings, and episode progress for the shows you watch, with the next episode ready. Shows have season and episode ratings.
- Imports: bring your ratings and watch history from IMDb, Letterboxd, Trakt, TMDB, Plex, Kodi, MovieLens, MyAnimeList, Kitsu or a CSV file.
- AI apps: connect GoodWatch to Claude, ChatGPT and other apps that support MCP, then ask what to watch, log episodes and rate titles by chatting.

GoodWatch is free, with no ads. You can browse without an account; a free account keeps your ratings, Wishlist and progress.
<!-- long-description:end -->

That's 1,461 characters. For a form with a lower limit, cut bullets from the end, keeping "One score", "Where it streams", and "Picks for your taste".

### Medium description (for forms that want one paragraph)

<!-- medium-description:start -->
GoodWatch is a free site for choosing a movie or show. It combines IMDb, Rotten Tomatoes, Metacritic and TMDB scores into one score, shows which of 325 streaming services in 139 countries has each title, and picks titles for your taste from a few ratings. You can search by mood, track your Wishlist and show progress, and import your history from Letterboxd, Trakt, IMDb, Plex and more.
<!-- medium-description:end -->

### Honest "alternative to" picks

Only list a product where GoodWatch does the same main job. Reviewers and voters on these sites drop listings that claim more.

| Product | Use it? | Why it's honest |
| --- | --- | --- |
| JustWatch | Yes, first | Same main job: where a movie or show streams, by country and service, with filters. |
| Reelgood | Yes | Streaming guide plus a watchlist and show tracking. |
| Trakt | Yes | Watch tracking, episode progress, ratings, and recommendations. GoodWatch imports Trakt history. |
| TasteDive | Yes | Recommendations from titles you like. |
| Simkl | Yes | Show and movie tracking with progress. |
| MovieLens | Yes, as a secondary pick | Rating-based movie recommendations. GoodWatch imports MovieLens ratings. |
| Letterboxd | Only with the note in the comment | GoodWatch covers ratings, a watchlist, lists, and recommendations, and imports Letterboxd. It has no reviews, diary, or social feed. Say so if the form has a comment field. |
| IMDb, Rotten Tomatoes, Metacritic | No | GoodWatch shows their scores, it doesn't replace them. |
| Netflix, Plex, Kodi | No | Players. GoodWatch doesn't play anything. |
| TV Time | No for now | Close for show tracking, but TV Time's main draw is its community. Revisit later. |

Pick order when a site allows only a few: JustWatch, Reelgood, Trakt, TasteDive, Simkl.

## Screenshots

All screenshots are of the live site, signed out, taken October 18, 2026. They're saved outside the repo, in `~/.cache/gw-listings/` (full path `/home/alp/.cache/gw-listings/`). Each was checked by eye: no cookie banner, no pop-up, no half-loaded posters.

| File | Size (px) | Shows |
| --- | --- | --- |
| `02-title-dune-part-two-1440.png` | 1440 x 900 | Dune: Part Two: GoodWatch score 85 with IMDb, Metacritic, and Rotten Tomatoes scores, Seen, Rate it, and Want to See, and "Where to watch" with five services |
| `03-discover-1440.png` | 1440 x 900 | Discover: sort, filters, "61,790 showing", two rows of posters with scores |
| `04-taste-1440.png` | 1440 x 900 | Taste page with the signed-out sample taste: taste headline, groups, "Fits your taste" cards |
| `01-start-1440.png` | 1440 x 900 | Start page intro: "Deciding is hard. So much to watch. Nothing to pick." over a poster wall |
| `02-title-dune-part-two-1440-full.png` | 1440 x 6398 | The whole title page, top to footer |
| `02-title-dune-part-two-390@3x.png` | 1170 x 2532 | Phone: title header, score card, rating buttons, providers |
| `03-discover-390@3x.png` | 1170 x 2532 | Phone: three-across poster grid |
| `04-taste-390@3x.png` | 1170 x 2532 | Phone: sample taste |
| `01-start-390@3x.png` | 1170 x 2532 | Phone: start page intro |

Each phone shot also exists at 390 x 844 (`...-390@1x.png`). Use the `@3x` files: they're sharper, and they pass size minimums.

Upload order, when a site takes several: title page, Discover, taste page, start page, then one phone shot (title page). The title page explains GoodWatch best in one image. The start page is a moment of the intro film, so it works as a hero image but says less on its own.

The images show TMDB posters and streaming service logos. Directory screenshots of an app are common practice, but confirm you're comfortable with that, as the backlinks research asks for the Claude carousel too.

## 1. Official MCP Registry

### What's in the repo

The manifest is [`goodwatch-webapp/server.json`](../../goodwatch-webapp/server.json): name `app.goodwatch/mcp`, version `1.0.0`, one `streamable-http` remote at `https://goodwatch.app/mcp`, no packages, three icons. The test `goodwatch-webapp/app/server/mcp/identity.test.ts` keeps it in sync with the server's own identity.

### Check against the current schema and docs (October 18, 2026)

| Check | Result | Source |
| --- | --- | --- |
| Schema version | `2025-12-11` is the newest released schema. The only newer change is in the unreleased draft (template variables at the start of a URL), which GoodWatch doesn't use. | [server.json changelog](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/CHANGELOG.md), [schema folder](https://github.com/modelcontextprotocol/static/tree/main/schemas) |
| Publisher CLI | `mcp-publisher` v1.8.1 (released August 6, 2026) is the newest release. The download checksum matched. | [registry releases](https://github.com/modelcontextprotocol/registry/releases) |
| Validation | `mcp-publisher validate goodwatch-webapp/server.json` against the live registry: "server.json is valid". | CLI run |
| Remote-only server | Allowed without `packages`. The URL must be publicly reachable. The registry checks the namespace, not the URL. Each remote URL can belong to only one server name. | [Publishing remote servers](https://modelcontextprotocol.io/registry/remote-servers) |
| Namespace | `app.goodwatch/*` is the reverse-DNS form of `goodwatch.app`, which DNS or HTTP login proves. | [Authentication](https://modelcontextprotocol.io/registry/authentication) |
| Name free | A registry search for `goodwatch` returned no servers, so the name and the URL are unused. | `GET https://registry.modelcontextprotocol.io/v0.1/servers?search=goodwatch` |
| Endpoint live | `POST https://goodwatch.app/mcp` without a token returns 401, as an OAuth server should. Icons at `/mcp-icons/goodwatch-{48,128,512}.png` return 200 `image/png`. `websiteUrl` (`/use-with-ai`) returns 200 and is `index, follow`. | curl |
| Versions | Each publish needs a new, unique version, and published metadata can't change. For a metadata-only update, publish `1.0.0-1`, `1.0.0-2`, and so on. | [Versioning](https://modelcontextprotocol.io/registry/versioning) |

Result: no manifest change is needed. The registry is still "in preview", so data resets can happen. If the listing disappears, publish again.

### Choose DNS or HTTP proof

| Option | What you do | Pick it when |
| --- | --- | --- |
| DNS (recommended) | Add one TXT record at the apex of `goodwatch.app` in Cloudflare. | You can edit DNS. Nothing to deploy, and the record keeps working for later versions. |
| HTTP | Serve the same `v=MCPv1; ...` line at `https://goodwatch.app/.well-known/mcp-registry-auth`. | You can't edit DNS. This needs a code change and deploy first; today that URL returns 404. |

The rest of this section uses DNS.

### Exact DNS record

The DNS for `goodwatch.app` is on Cloudflare (name servers `melody.ns.cloudflare.com` and `stan.ns.cloudflare.com`). The apex already has two TXT records, the SPF record and the Purelymail ownership proof. Keep both. Add a third:

| Cloudflare field | Value |
| --- | --- |
| Type | `TXT` |
| Name | `@` (the apex, `goodwatch.app`). Not `_mcp`, `_mcp-auth`, or any other selector: the registry only reads the apex. |
| Content | `v=MCPv1; k=ed25519; p=<PUBLIC_KEY>`, where `<PUBLIC_KEY>` is the 44-character base64 value from step 2. Type it without surrounding quotes. |
| TTL | Auto |

If you ever rotate the key, delete the old `v=MCPv1` record. A stale record is tried first and makes login fail.

### Steps

The commands are bash. Your terminal runs fish, so start `bash` first. They need OpenSSL 3 or later (this machine has 3.6.5). I ran steps 2 and 4 with a throwaway key to check that both commands work and that the private key comes out as 64 hex characters.

1. Install `mcp-publisher` 1.8.1:

   ```bash
   mkdir -p ~/.local/bin && cd "$(mktemp -d -p ~/.cache)"
   curl -fsSLO https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_linux_amd64.tar.gz
   curl -fsSLO https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/registry_1.8.1_checksums.txt
   grep 'mcp-publisher_linux_amd64.tar.gz$' registry_1.8.1_checksums.txt | sha256sum -c -
   tar -xzf mcp-publisher_linux_amd64.tar.gz -C ~/.local/bin mcp-publisher
   mcp-publisher --help
   ```

2. Generate the key once and keep it outside the repo. Back up `registry-key.pem`: you need it for every later version.

   ```bash
   umask 077
   install -d -m 700 ~/.local/share/goodwatch-mcp-registry
   cd ~/.local/share/goodwatch-mcp-registry
   test -e registry-key.pem || openssl genpkey -algorithm Ed25519 -out registry-key.pem
   PUBLIC_KEY="$(openssl pkey -in registry-key.pem -pubout -outform DER | tail -c 32 | base64)"
   echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}"
   ```

3. Add the printed line as the TXT record in the preceding table. Check that it's public (`dig` isn't installed here, so this uses DNS over HTTPS):

   ```bash
   curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=goodwatch.app&type=TXT' | grep -o 'v=MCPv1[^"\\]*'
   ```

4. Log in. The private key never leaves this shell:

   ```bash
   cd ~/.local/share/goodwatch-mcp-registry
   PRIVATE_KEY="$(openssl pkey -in registry-key.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
   mcp-publisher login dns --domain goodwatch.app --private-key "${PRIVATE_KEY}"
   unset PRIVATE_KEY
   ```

5. Validate and publish from an up-to-date checkout of `main`:

   ```bash
   cd ~/dev/projects/goodwatch/goodwatch-monorepo
   git fetch origin && git show origin/main:goodwatch-webapp/server.json > ~/.cache/goodwatch-server.json
   mcp-publisher validate ~/.cache/goodwatch-server.json
   mcp-publisher publish ~/.cache/goodwatch-server.json
   ```

   Using `git show` publishes exactly what's on `main`, even if the local checkout is behind.

6. Confirm:

   ```bash
   curl -fsS 'https://registry.modelcontextprotocol.io/v0.1/servers?search=app.goodwatch/mcp'
   ```

   The result shows `app.goodwatch/mcp`, version `1.0.0`, and the remote `https://goodwatch.app/mcp`. Record the date in the link event log on issue #667.

PulseMCP has paused its own submissions and says it will pick servers up from the registry when it reopens. Glama also syncs from the registry. Neither needs a separate step today.

## 2. AlternativeTo

Rules: [AlternativeTo FAQ](https://alternativeto.net/faq), read October 18, 2026. The form is behind a login, so field names come from the FAQ and from live listings (JustWatch, Letterboxd, Reelgood, Trakt, Simkl, TasteDive). GoodWatch isn't listed yet.

### Rules that matter

- The app must support English and be released. Apps limited to some countries are declined; GoodWatch works worldwide.
- Descriptions must not contain addresses, phone numbers, emails, or website links. The shared descriptions have none.
- No UTM tags on the website link. One entry per product.
- AlternativeTo now declines more apps, including "content rather than software" such as blogs, guides, and **review sites**. GoodWatch is a discovery and tracking app, not a review site, and the descriptions lead with what it does for you (matches, where to watch, tracking, imports, AI apps). Keep it that way if you edit them.
- No liking or reviewing from extra accounts, and no rewards for likes.
- Review time: the free queue holds "several thousand apps" with no promised date. Paid priority review is "usually reviewed within 1-2 business days"; it doesn't buy approval. The price shows only at checkout. Use the free queue.

### Steps

1. Sign up and verify your email.
2. Select your user icon, then **Suggest new application**.
3. Fill in the form with the following table, then **Submit the application**. The pending app shows under **My submissions**.
4. When it's approved, open each app in the "Alternative to" row, select **Contribute to this page**, then **Suggest Alternatives**, and add GoodWatch.

### Form values

| Field | Value |
| --- | --- |
| Name | GoodWatch |
| Short description or tagline | The [short description](#short-description-153-characters) |
| Description | The [long description](#long-description) |
| Category | Video & Movies (add Online Services if it asks for a second) |
| Platforms | Online. Nothing else: there's no native app. |
| License | Free. Tick Open Source and give the GitHub repository link from the site footer, if you're happy to show the source. |
| Tags | Movie Discovery, TV Shows, Recommendations, Episode Tracker, Search Engine |
| Features | Where to Watch, Personalized Recommendations, Content Discovery, Watchlists, Movie Database, User Rating, Track movies, Custom List Creation, No registration required, Ad-free, Dark Mode |
| Official website | `https://goodwatch.app` |
| Icon | `goodwatch-webapp/public/mcp-icons/goodwatch-512.png`. AlternativeTo suggests a square image of at least 280 x 280 px with a transparent background; this one has a dark square background, which is accepted. |
| Screenshots | The four 1440 px files from [Screenshots](#screenshots), in that order |
| Alternative to | JustWatch, Reelgood, Trakt.tv, TasteDive, Simkl. Add Letterboxd only with the note from [the picks table](#honest-alternative-to-picks). |

AlternativeTo's "AI-Powered" property fits too (every title gets an AI title analysis), but leave it off. It invites the "thin LLM wrapper" check, and AI isn't the main job.

## 3. SaaSHub

Rules: [Submit page](https://www.saashub.com/submit) and [`/services/submit`](https://www.saashub.com/services/submit), read October 18, 2026. Step 1 is public; step 2 needs an account, so its fields come from SaaSHub's advice page and live listings.

### Rules that matter

- Listing competitors matters most: "The submission will be slowed down and put to the bottom of the queue if there are not listed competitors." Products with more competitors are approved first.
- Verifying gives priority and a green badge. It needs an email address on the product's domain (any `@goodwatch.app` address, such as the support mailbox) or an HTML meta tag. Use the email.
- Verify again every 3 months to come back on the home page.
- English only, released products only. No email submissions.
- Free. The paid Featured listing ($99 a month) is the only way to get a followed link or a screenshot in lists. Skip it: a paid link breaks Google's link spam policy.

### Steps

1. Create an account.
2. On `/services/submit`, enter `https://goodwatch.app` and select **Continue**.
3. Fill in the form with the following table.
4. Verify with the email link sent to the `@goodwatch.app` address.

### Form values

| Field | Value |
| --- | --- |
| Website URL | `https://goodwatch.app` |
| Name | GoodWatch |
| Tagline | Find what to watch for your taste, and see where it streams |
| Description | The [medium description](#medium-description-for-forms-that-want-one-paragraph). Use the long one if the field is large. |
| Pricing | Free |
| Logo | `goodwatch-webapp/public/mcp-icons/goodwatch-512.png` |
| Categories (up to 5) | Movie Recommendations, Movie Trackers, Movie Streaming, Movie Ratings, TV Shows |
| Competitors | JustWatch, Reelgood, Trakt.tv, Simkl, TasteDive, MovieLens, Letterboxd, Criticker |
| Country | Your country of residence (SaaSHub shows a country of origin) |

SaaSHub's competitors list is broader than AlternativeTo's "alternative to" and only says the products overlap, so Letterboxd fits here without a note. Criticker is a taste-based rating and recommendation site, the same job as GoodWatch's taste matching.

## 4. Launching Next

Rules and fields: the [submit page](https://www.launchingnext.com/submit/) as archived on [August 12, 2026](https://web.archive.org/web/20260812005136/https://www.launchingnext.com/submit/). The live page blocks automated reads, so check the form matches when you open it. No login, no images, no categories.

### Rules that matter

- Free. Submissions are reviewed daily, and you get an email if they publish it.
- The paid express review ($99 on the archived page, "from $149" on another page of theirs) is offered on the next page. Skip it.

### Form values

| Field | Limit | Value |
| --- | --- | --- |
| Startup Name | 100 | GoodWatch |
| Startup URL | 100 | `https://goodwatch.app` |
| Your headline | "5-8 words" | Find what to watch for your taste |
| Full startup description | 2,500 | The [long description](#long-description) |
| Tags | "5-10 tags", 500 | Movies, TV Shows, Streaming, Recommendations, Entertainment, Search, Web App, AI, Free |
| Which best describes your submission? | Choice | The true one. "A side project" fits a free product with one developer and no funding; "A bootstrapped startup" fits if you treat it as a business. |
| Marketing spend, next 90 days | Choice | $0 |
| Your name, your email | Not published | Yours |
| Newsletter | Pre-ticked | Untick it unless you want it |
| What is 2+3? | Captcha | 5 |

## 5. Tiny Startups

Rules and fields: [submit page](https://www.tinystartups.com/submit) and its page code, plus [`/about`](https://www.tinystartups.com/about) and [`/terms`](https://www.tinystartups.com/terms), read October 18, 2026. No separate sign-up: the form creates an account from your email.

### Rules that matter

- "Every listing is hand-approved." Free submissions get no guaranteed date or approval. Products must be real and working, in English.
- Ranking is upvotes only. Don't ask anyone to upvote.
- Free listings get a `nofollow` link; only the paid instant listing gets a followed one. Skip every paid upgrade: buying the followed link breaks Google's link spam policy.
- The free route may ask you to "verify with a post" (the button reads "Skip — I will verify with a post"). What that post must be isn't documented. If it asks you to post about Tiny Startups on X, decide then; it isn't required for the other listings.
- Revenue is required. "Pre-revenue" is an accepted answer. "Fake numbers ... will lead to a ban."

### Form values

| Step | Field | Limit | Value |
| --- | --- | --- | --- |
| 1 | Your startup's URL | | `goodwatch.app` |
| 2 | Name | 60 characters, 3 words | GoodWatch |
| 2 | Tagline | 10 to 200 | The [short description](#short-description-153-characters) (153) |
| 2 | Category | Choose one | Other. There's no media or entertainment category. AI would undersell what the site is. |
| 2 | Three things that set it apart | 60 each | One score from IMDb, Rotten Tomatoes, Metacritic, TMDB (54) / Where it streams: 325 services in 139 countries (47) / Picks for your taste, also inside Claude and ChatGPT (52) |
| 2 | Longer description | 50 to 500 | The [medium description](#medium-description-for-forms-that-want-one-paragraph) (387) |
| 2 | Your email | | Yours. It also subscribes you to their newsletter. |
| 2 | Logo | PNG, JPEG, or WebP | `goodwatch-webapp/public/mcp-icons/goodwatch-512.png` (the default is the favicon, which is too small) |
| 2 | Cover | PNG, JPEG, or WebP | `02-title-dune-part-two-1440.png` (the default is the start page's preview image) |
| 3 | Revenue | Required | Pre-revenue |
| 4 | Where are you based? | | Your country |
| 4 | How did you hear about us? | | The true answer, probably "Other" |
| 4 | X handle | Optional | Leave empty unless you want the account linked |
| 4 | When did you launch? | Month and year | The month in 2023 when GoodWatch went live |
| 5 | Upgrades | | Skip — continue with my free listing |

## 6. Claude Connectors Directory

The submission kit is [`docs/implementation/mcp-directory-listing.md`](../implementation/mcp-directory-listing.md). It has the listing copy, the populated reviewer account, the prompts and shot list for the carousel, the tool check, and the portal steps. This section records what I checked on October 18, 2026, and what's still missing.

### Kit check against the current docs

I reread the [submission page](https://claude.com/docs/connectors/building/submission), the [pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria), and [Publish to the directory](https://claude.com/docs/directory/publish).

| Requirement | Status |
| --- | --- |
| Paid plan (Pro, Max, Team, or Enterprise). On Pro and Max you submit from your own account. | You have one. |
| Remote HTTPS server, OAuth 2.0 | Done: `https://goodwatch.app/mcp`, with CIMD and DCR. |
| Every tool has a `title` and `readOnlyHint` or `destructiveHint` | Done. The code still registers 25 tools (15 reads, 10 writes). Reads set `readOnlyHint: true`; all 10 writes set `destructiveHint: true`. |
| Tool names of 64 characters or fewer, separate read and write tools | Done. |
| Listing: name up to 100 characters, one-liner up to 200, description up to 2,000, 1 to 5 categories, docs URL, privacy URL, support contact, icon, permanent slug | Done in the kit. The live category list is only visible in the portal. |
| Test account for reviewers, fully populated | Done: the reviewer account in the kit. Its password is in a root-only file on the database host, and you paste it into the portal's private field. |
| MCP App carousel: 3 to 5 PNG files, at least 1,000 px wide, the app response only, a prompt for each | **Missing.** The kit has the prompts and the shot list, but the images have to come from a real Claude.ai session signed in to the reviewer account. |
| You ran every tool in Claude and MCP Inspector | **Missing.** The portal asks you to confirm this, so it has to be true first. |
| Public documentation | Done: `https://goodwatch.app/use-with-ai` and `https://goodwatch.app/support`. |
| Allowed link URIs | `https://goodwatch.app` only, as the kit says. |
| Seven compliance acknowledgments | You answer them in the portal. |
| Terms page | Not required by Claude. `/terms` still returns 404; ChatGPT will need one later. |

### Two review risks

1. **Data handling and the TMDB terms.** The portal asks whether the API is your own, proxied with permission, or a third party's. GoodWatch's API is first-party, but titles, posters, and availability come from TMDB and others. Answer truthfully, and settle the TMDB question first.
2. **Tool wording resolved October 19.** The owner chose to remove all answer-formatting and promotional directives from all 25 tool descriptions and replace initialization instructions with neutral result-field facts. Canonical title/person URLs, ready-made links and list `page_url` fields remain. The [cleanup report](../implementation/mcp-description-cleanup-2026-10-19.md) lists every description before/after and explains the current [review checklist](https://claude.com/docs/connectors/building/review-criteria) and [directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy). Deploy this change before submitting; directory acceptance remains Anthropic’s decision.

### Steps

1. Decide the TMDB question.
2. Deploy the October 19 description cleanup before submitting.
3. In Claude.ai, add `https://goodwatch.app/mcp` as a custom connector and sign in as the reviewer account (password from the root-only file named in the kit).
4. Run every tool once in Claude, and once in MCP Inspector (`npx @modelcontextprotocol/inspector`, transport Streamable HTTP, the same URL).
5. Run the five carousel prompts from the kit. Capture only the response, as PNG, at least 1,000 px wide. Check the size with `file *.png`.
6. Open the [developer portal](https://claude.ai/directory/manage), select **Submit new**, choose **MCP connector**, and follow the ten steps in the kit's "Owner submission steps" section.
7. Track the status in the portal. By default an automated scan lists it as a Community connector. Escalations go to the address in the submission docs.

## After submitting

Log each listing in the link event log on issue #667: the date, the listing URL, the link type, and the target page. Then:

- AlternativeTo: when the listing is live, add GoodWatch as an alternative on the JustWatch, Reelgood, Trakt, TasteDive, and Simkl pages if the listing form didn't do it.
- SaaSHub: verify the product again every 3 months to stay eligible for the home page.
- Don't ask anyone to like, upvote, or review a listing. Each of these sites penalizes it.

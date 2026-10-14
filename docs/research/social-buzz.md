# Social buzz: pulling "what's hot right now" into GoodWatch

As of **2026-10-14**. Purpose: decide how GoodWatch could show what people are discussing right now about movies and TV shows: news, YouTube Shorts, TikToks, Reels, Reddit threads, and posts on X, Bluesky and Threads.

Backlog context: `TODO.md` has "data source: social media content (tiktok, ig, yt shorts, reddit, twitter, etc.)", "clips: ensembledata.com, tiktok, youtube shorts, reels", "reddit sentiment analysis", and the trending-history items "save trending scores per day / trending yesterday / trending difference". `docs/research/roadmap-backlog-reconciliation.md` lists all of them as Unresolved.

## Evidence limits

Platform terms and prices changed a lot during 2025–26. Facts marked **(official)** come from vendor documentation. Everything else comes from 2025–26 secondary sources, many written by scraping vendors, or from general knowledge, and is marked **(unverified)**. Check each platform's current terms and pricing page before building on it or budgeting for it.

## The core idea: separate the signal from the content

"What's hot" splits into two problems with very different access situations:

1. **The buzz signal:** which titles are being discussed right now, and how much more than usual. This can be built almost entirely from free sources with low legal risk.
2. **The buzz content:** the actual clips, posts and articles shown on a title. Social video is only legally reachable as **embeds**. Automated *discovery* of TikToks and Reels has no legal commercial API.

So the safe design is to compute a GoodWatch **buzz score** per title from open signals, then attach content per title from sources that allow it (YouTube, news headlines, Bluesky/X/Threads posts), plus curated TikTok, Reels and Reddit embeds.

## What changed in the last 12 months

- **Reddit:** self-service API keys ended on 2025-11-11. New OAuth clients need manual approval under the Responsible Builder Policy. Unauthenticated `.json` endpoints have returned 403 since about the end of May 2026. Commercial use needs a contract.
- **X:** pay-per-use has been the default since February 2026, at about $0.005 per post read with a cap of 2M reads per month. The Basic and Pro tiers are closed to new sign-ups.
- **YouTube:** the Trending page was replaced by YouTube Charts in July 2025; there is a "Trending Movie Trailers" chart. Whether the `chart=mostPopular` API changed is not established, so test it.
- **Google Trends:** an official API alpha was announced in July 2025. It is by application only, with no pricing and no general availability date.
- **Wikimedia:** API rate-limit enforcement began in March and April 2026. A descriptive User-Agent is required.
- **Meta oEmbed:** apps created after 2025-04-08 need the reviewed "Meta oEmbed Read" permission. Instagram oEmbed no longer returns thumbnail or author fields.
- **Threads:** the official keyword search allows 2,200 queries per user per 24 hours **(official, 2026-01)**.

## Sources

| Source | Access | Cost | Signal for a title | Display | Risk |
|---|---|---|---|---|---|
| Wikipedia pageviews | Open REST API | Free | Daily views per article; spikes against baseline | n/a | Very low |
| TMDB trending | Existing key | Free for non-commercial use; commercial use needs a TMDB licence **(official FAQ)** | Day and week lists | n/a | Low (same licence question as all our TMDB use) |
| Trakt trending | Free key, about 1 request per second | Free (commercial terms unclear) | People watching now | n/a | Low–medium |
| GDELT DOC 2.0 | Open, no key | Free | `timelinevol` news-volume series per query; 3-month window | Link out | Low |
| Trade press RSS (Variety, Deadline, THR, IndieWire, Collider) | Open feeds | Free | Headline mentions | Headline, short excerpt and link only | Low |
| Google News RSS | Open | Free | Query per title | Link | Medium (meant for non-commercial use) |
| NewsAPI.org | Key | Free tier is dev-only with a 24 h delay; $449/mo business tier **(official)** | Article count | Link | Low |
| YouTube Data API v3 | Key | Free; 10k units per day; `search.list` costs 100 units, `videos.list` costs 1 **(official)** | `mostPopular` in category 1 (Film & Animation) or 44 (Trailers); studio channel uploads; search for top titles | iframe on `youtube-nocookie.com` | Low (30-day refresh rule, branding) |
| Bluesky Jetstream | Open WebSocket firehose, no auth | Free | Filter posts locally by title, hashtag or links to IMDb, Letterboxd and TMDB | embed.bsky.app | Low |
| Threads | API, App Review needed | Free; 2,200 queries per day | Keyword search | oEmbed | Low–medium |
| X | Pay-per-use | About $0.005 per read | Recent search with engagement | oEmbed (no key, unverified) | Low–medium (cost) |
| Reddit | OAuth with manual approval | Free for non-commercial use at 100 QPM; commercial use by contract at an unknown price | Search in r/movies, r/television, r/boxoffice and per-show subs; score and comment velocity | Post embed (no key, unverified) | High without a commercial agreement |
| TikTok | The Research API is for academics only; there is **no commercial discovery API** | n/a | None legally | oEmbed or `tiktok.com/player/v1/{id}` with no key **(official)** | Medium–high if scraped |
| Instagram Reels | Graph API with a Business account and App Review | Free; 30 unique hashtags per 7 days | `top_media` per hashtag | oEmbed (app token and review) | Medium |
| Google Trends | Alpha by application, or SerpApi | Unknown, or SerpApi from $25/mo | Search interest | n/a | Low–medium |
| Letterboxd | API by request only, and it excludes recommendation and analysis use | n/a | n/a | Link out | High (scraping breaches its terms) |
| IMDb MOVIEmeter | Licensed through AWS Data Exchange or IMDbPro | Contract pricing; one related product lists $150k/yr | MOVIEmeter | n/a | Low but costly |

Scraping vendors cover the gaps for TikTok, Reels and Reddit:

- ScrapeCreators: from about $10 per 5k requests.
- EnsembleData: free 50 units per day; $100–800/mo.
- SerpApi: $25–275/mo.
- Apify: about $0.3–5 per 1k results.

All of them scrape. They take on the legal risk, but GoodWatch still breaches the platform's terms by using the data, and none of them is a licence. Prices are **(unverified)**.

## Legal and EU constraints

- **Embed, never re-host.** Store only platform IDs and URLs plus our own computed scores. When a creator deletes a post, the embed stops showing it. Downloading videos or thumbnails breaks every platform's terms and creates copyright exposure.
- **YouTube:** API data must be refreshed or deleted within 30 days **(official developer policies)**.
- **News:** store and show headline, a short excerpt and a link only. No full text, no images.
- **GDPR and ePrivacy consent:** YouTube, TikTok, Instagram and X embeds send the visitor's IP to the platform and set storage on load. In the EU that needs prior consent, and `youtube-nocookie` alone is generally not considered enough. Use click-to-load facades: our own placeholder with a "Load TikTok content" button. Facades also protect page performance and work with the page cache, because they are plain HTML until clicked.
- **DSA:** showing third-party user content in our own feed brings notice-and-action expectations. Keep a "report / hide" path for every embedded item.
- **Scraping case law:** the US district court rulings in Meta v. Bright Data (2024) and X v. Bright Data (dismissed, then revived) are not a safe harbour, especially for logged-in scraping.

## How it fits the current system

What exists today (see `goodwatch-flows/windmill/f/` and `goodwatch-webapp/app/`):

- **Ingestion:** Windmill flows follow a `next` → `fetch` pattern, from source into MongoDB, then `f/sync/copy/*` into CrateDB, then into Qdrant.
  - `f/critic_sites/polite_http.py` is the model for polite fetching: an honest User-Agent, about one request every 2 s per site, and a shared back-off on 403 or 429.
  - `f/external_ids/` already maps titles to Wikidata. That gives Wikipedia article titles, the join key for pageviews.
- **Already stored:**
  - TMDB videos in the Crate table `media_video`, with the YouTube key, type and `published_at`. They are rendered via `app/ui/details/Media.tsx` and `YoutubePlayer.tsx`.
  - TMDB `popularity` on `movie` and `show`.
  - There is no trending table and no flow for it. Trending rows existed in the old app (see `CHANGELOG.md`).
- **Webapp plug-in points:**
  - **Title page:** add a section to `app/ui/details/sections.ts` and load it as a below-fold extra through `app/server/title-extras.server.ts`, cached with `cached()` in `app/utils/cache.ts`.
  - **Start page:** a "Talked about now" row next to the start titles in `app/ui/living-room/BelowRoom.tsx`. Its loader is `app/server/living-room/start-titles.server.ts`. The row is the same for every visitor, so it fits the anonymous page cache and the warm-up in `docs/homepage-cache-warmup.md`.

## Proposed phases

### Phase 1: Buzz score (free, low risk, no new UI risk)

1. **New flow `f/buzz/`** that collects these signals daily and stores them per title per day in a `title_buzz_daily` table:
   - Wikipedia pageviews for titles with a Wikidata link.
   - TMDB `trending/{movie,tv}/day`, plus the change in TMDB `popularity`.
   - GDELT `timelinevol` for the top N candidates.
2. **Score:** a z-score of today against the title's own 28-day baseline, combined across signals.
   - The score measures "unusually discussed for this title", not "big title". That is what makes it "hot" rather than "popular".
   - The daily rows also resolve the backlog items "trending scores per day / yesterday / difference".
3. **Start page:** add a "Talked about now" row from the top buzz scores, filtered to titles in our catalog.

### Phase 2: Content per title (embeds only)

1. **YouTube:**
   - Daily `videos.list?chart=mostPopular` for categories 1 and 44 in the main regions. This costs only a few units.
   - Read the upload playlists of studio and trailer channels.
   - Match the videos to titles by title text and year, using the TMDB `media_video` keys as anchors.
   - Treat a video as a Short when it is 3 minutes or shorter and the `/shorts/{id}` URL resolves.
   - Run `search.list` only for the top ~50 buzz titles a day; that is 5k of the 10k daily quota units.
2. **News:**
   - Poll the trade RSS feeds about every 30 minutes.
   - Match headlines to titles. Exact title plus year or cast names is enough for the first pass, with an LLM disambiguation step available through the existing OpenRouter integration in `f/dna/`.
   - Show the headline, source, time and a link.
3. **Bluesky:**
   - A small long-running Jetstream consumer that keeps posts linking to IMDb, TMDB or Letterboxd, or mentioning top-buzz titles.
   - Count posts toward the buzz score and embed a few top posts.
4. **UI:**
   - A "Buzz" section on the title page with news headlines, YouTube clips and Shorts, and posts.
   - Every third-party embed sits behind a click-to-load facade.

### Phase 3: TikTok, Reels and Reddit (needs a decision)

There is no legal automated discovery for TikTok and Reels, and Reddit commercial use needs a contract. The options are:

- **a. Curated embeds:** an editor, or a member submission, pastes a TikTok, Reel or Reddit URL onto a title. We store the URL and render it through oEmbed or the TikTok player behind the facade. This is legal, cheap and good quality at low volume.
- **b. Vendor scraping:** ScrapeCreators or EnsembleData for TikTok hashtag search, about $100/mo. This is automated, but it breaches the platform's terms (the vendor carries the legal risk, but GoodWatch still breaches the terms).
- **c. Apply for official access:** a Reddit commercial agreement, Threads and Instagram App Review, and the X pay-per-use plan for a few hundred queries a day. This takes the most time, but it is the most durable option.

Recommendation: do **a** now, apply for **c** in parallel (starting with Threads and X, which are quick and cheap), and avoid **b** unless the curated volume proves insufficient.

## Open questions

- Is GoodWatch's TMDB use already under a commercial licence? Trending relies on the same terms.
- Which regions should the YouTube `mostPopular` lists cover? This should match the countries GoodWatch targets.
- Should "Talked about now" respect On my services by default, as interest discovery does, or stay global like Start titles?
- Is there a consent manager (CMP) in the webapp today, or would the embed facade be the first consent surface?

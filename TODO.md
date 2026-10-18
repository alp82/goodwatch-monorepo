# GoodWatch Living Roadmap

## Destination

Continuously help GoodWatch focus on the right work: bring order to the backlog, give direction to priorities, and reassess what deserves attention as goals, evidence, and circumstances change. Use research from time to time to inform and challenge that direction.

The product target can move. This map remains useful by explaining the current focus, why it matters now, and what could change it. Individual focused maps have bounded destinations and can finish.

## Current Focus

**Why it matters now:** GoodWatch's backlog covers user experience (onboarding, rating, start page), core discovery mechanisms (recommendations, discover filters, TV seasons, details), SEO & growth, and infrastructure/crawling reliability. Bringing structure to these distinct domains enables prioritizing low-friction improvements while identifying evidence needed before embarking on major overhauls.

**What could change it:** Shifts in user feedback, analytics on user retention during onboarding, data scraping blockages, or changes in third-party API availability.

## Active Frontier

High-level active roadmap priorities and immediate evidence gathering:

- [ ] **Data Quality & Bug Fixes:** Resolve rating link mismatches and score inconsistencies between list and detail views.
- [ ] **Onboarding & UX Improvements:** Fix desktop scroll freeze during rating, auto-close rating modal, improve step 2 instructions, and optimize search performance for long titles.
- [ ] **SEO & Growth Strategy:** Execute core SEO checklist and metadata build improvements to improve organic search visibility.

## Area Discussions

### 1. Onboarding & User Experience
- **Motivation:** Streamline the first-time user journey and reduce friction when rating titles or searching during onboarding.
- **Candidate Problems & Ideas:**
  - Onboarding recommendations should be interactive/clickable links.
  - Fix desktop scroll freezing when "Rate this" modal is active; ensure modal automatically closes after saving.
  - Mobile rating experience: explore iOS exposure slider / carousel ([motion.dev example](https://motion.dev/examples/react-carousel-ios-exposure-slider)) and swipe scorer for detail views.
  - Improve step 2 instructions and place card titles above posters for long titles.
  - Address search latency and accuracy for long titles (e.g., "Orange is the New Black").
  - Onboarding sequence tweaks: remove Gladiator (1992) as first title, switch display order based on last rating, and implement user settings cache + invalidation.
- **Available Evidence & References:**
  - Discord discussion on onboarding recommendations: [Discord Link](https://discord.com/channels/1176974285131223091/1463986161700700272/1464143808240554035)
  - Interactive recommender reference: [anime.ameo.dev](https://anime.ameo.dev/interactive-recommender?r=1535-10&r=1575-10&r=136-10&r=121-7)
  - Design references: [kinu-app.com](https://kinu-app.com/), [veboli.com](https://veboli.com/)
- **Unknowns:** Optimal cache TTL for user settings invalidation during onboarding.

### 2. Recommendations & Discovery
- **Motivation:** Provide richer, more personalized recommendation pathways and intuitive discovery mechanisms across movies and TV shows.
- **Candidate Problems & Ideas:**
  - Personal recommendations by main Fingerprint categories and "For You" landing page with examples.
  - Dynamic UI enhancements: background color changes with scroll ([fable.co](https://fable.co/)).
  - Recommendations with user streaming filter and personal rating indicator ("How much do I like this movie or show?").
  - Combined recommendation filters (e.g., Thriller + Comedy with AI integration).
  - Discover sorting options: by similarity, own score, last watched, last wishlisted.
  - Discover ordering options: highest score, most controversial (critics vs. audience), trending.
  - Explore internal recommendations / cross-links (e.g., Action -> Superhero, "If you like X, check out Y").
  - Show availability in other countries / VPN options ("where to watch VPN").
- **Available Evidence & References:**
  - Interactive recommender benchmark: [anime.ameo.dev](https://anime.ameo.dev/interactive-recommender?r=1535-10&r=1575-10&r=136-10&r=121-7)

### 3. User Lists, Profiles & Engagement
- **Motivation:** Empower users to manage, analyze, and share their media collections easily.
- **Candidate Problems & Ideas:**
  - **User Profile:** Display all scores grouped by tier, shareable profile links, and cross-platform profile links (e.g., MyAnimeList).
  - **Watched / Ratings Page:** Rating distribution stats (1-10 scale), search & filter, easy rating actions (personalized).
  - **Favorites Page:** Search & filter, easy addition flow.
  - **Want to Watch / Wishlist:** Proper unauthenticated/guest handling, split into "Watch Now" vs "Rest", search & filter, evaluate removing separate wishlist page.
  - **Feedback & Community:** In-app feedback form linked to Discord.
- **Available Evidence & References:**
  - Discord discussion on shareable profiles: [Discord Link](https://discord.com/channels/1183008154573881384/1183008156696182847/1326508243056590848)

### 4. Start Page & Design
- **Motivation:** Refresh the landing/start page experience to maximize engagement and present compelling content highlights.
- **Candidate Problems & Ideas:**
  - New start page layout concept: living room / remote control theme ([ChatGPT design concepts](https://chatgpt.com/c/6aa52454-cd3c-83eb-a121-74195a4b6a4b)).
  - Ensure "What's the vibe" excludes user-rated/saved titles.
  - Make `movietvlist` compatible with Swiper.
  - Select top 10 page data categories to feature on the start page.
  - Display overall platform stats (total movies and TV shows indexed).
- **Available Evidence & References:**
  - Design inspo: [moviewiser.com](https://moviewiser.com/), [reactbits.dev card-swap](https://www.reactbits.dev/components/card-swap), [reactbits.dev light-rays](https://www.reactbits.dev/backgrounds/light-rays)

### 5. Data Depth, TV Seasons & Data Integrity
- **Motivation:** Deliver rich media details and ensure data accuracy across ratings and metadata.
- **Candidate Problems & Ideas:**
  - **TV Seasons & Episodes:** Track season/episode details (overview, images, videos, translations, air date, crew, guest stars), aggregated ratings (TMDB, IMDb, Metacritic, Rotten Tomatoes), release freshness indicators, season score matrix ([tvcharts.co](https://tvcharts.co/show/arcane-tt11126994)), and recaps.
  - **Rich Details:** Integrate TV Tropes, images, box office stats, awards API, and vote counts.
  - **Data Integrity:**
    - Fix wrong rating links by validating crawler release years against target metadata (e.g., [Sirt](https://goodwatch.app/movie/1151272-sirt?country=DE), [The Circus](https://goodwatch.app/movie/616027-the-circus)).
    - Fix score inconsistencies between listing cards and detail pages.
    - Handle type misclassifications (e.g., TV shows classified as movies like [Stranger Things](https://goodwatch.app/movie/1412450-stranger-things) or [Wednesday](https://goodwatch.app/movie/1412549-wednesday)).
- **Unknowns:** Reliability of automated year checking to detect all incorrect rating links.

### 6. Crawling & Infrastructure Solutions
- **Motivation:** Maintain robust scraping and data aggregation capabilities while respecting rate limits and anti-bot measures.
- **Candidate Problems & Ideas:**
  - Rate limiting and crawling research (including TV Tropes).
  - Evaluate proxy and scraping solutions:
    - [Scrapoxy](https://scrapoxy.io/)
    - [Evomi](https://evomi.com/pricing)
    - [DataImpulse](https://dataimpulse.com/)
    - [Firecrawl Agent & Docs](https://www.firecrawl.dev/)
    - [PyDoll](https://github.com/autoscrape-labs/pydoll)
  - Explore GoodWatch Model Context Protocol (MCP) servers and AI agent skills.

### 7. SEO, OpenGraph & Marketing
- **Motivation:** Drive organic acquisition through enhanced search engine indexing and attractive social share previews.
- **Candidate Problems & Ideas:**
  - Enhanced OpenGraph image generation (dynamic images with text; references: [Remix OG](https://www.jacobparis.com/content/remix-og), [Gemini](https://gemini.google.com/app/8f9832dc2c62d13a), [Tailwind Generator](https://tailwind-generator.com/og-image-generator/generator)).
  - Build better `buildMeta` and `JsonLD` generators.
  - Fingerprint pages and popular keyword landing pages.
  - SEO checklist execution: unique content audit, search intent alignment, canonical & noindex tag validation, Google Search Console live rendering, sitemap submission, structured data, internal linking structure.
- **Available Evidence & Tools:**
  - [HubSpot Website Grader](https://website.grader.com/tests/goodwatch.app)
  - [SEO Site Checkup](https://seositecheckup.com/)
  - [Ahrefs Site Audit](https://app.ahrefs.com/site-audit/7410991/overview?current=19-12-2024T034232)
  - [N-gram Analyzer](http://guidetodatamining.com/ngramAnalyzer/index.php)
  - [SparkToro Search Query Research](https://sparktoro.com/blog/new-research-we-analyzed-332-million-queries-over-21-months-to-uncover-never-before-published-data-on-how-people-use-google/)

## Out of Scope

Deferred feature scopes and prototypes preserved as closed references:

- Implementation of specific AI agent skills or MCP extensions until core data APIs are finalized.
- Automated bulk scraper migration before proxy provider selection is finalized.

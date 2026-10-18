# Developer news aggregators and technical blogging platforms

Researched 2026-10-18. The angle: technical write-ups about things GoodWatch really built, linking to goodwatch.app and the public repo. Hacker News, Product Hunt, Reddit, X, Bluesky, Mastodon and MCP directories are covered by other files and skipped here.

How link attributes were checked: I downloaded a live article page from each platform on 2026-10-18 and read the `rel` attribute on links inside the article body. Where a page blocked the download (Cloudflare challenge or 403), the row says "not verified". Where I read the platform's open-source code instead, it says so.

Labels:

- **Verified (live HTML)**: read in the served HTML on 2026-10-18.
- **Verified (source code)**: read in the platform's public source.
- **Doc**: the platform's own rules, FAQ or docs.
- **Anecdotal**: someone's public report of their own numbers. Not a forecast.
- **(not verified)**: I could not confirm it from a primary source.

---

## Summary table

| Platform | Effort per piece | Ban risk | Link value (rel on body links) | Expected traffic | Prerequisites | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| dev.to | Low (cross-post) | Low if the post teaches something | **Followed** (`noopener noreferrer`), canonical honored | Low to medium, long tail from dev.to's own search ranking (no public per-post numbers found) | Account only | **High** |
| Hashnode (free hashnode.dev blog) | Low (cross-post) | Low | `noopener ugc` | Low (not verified) | Account; custom domain needs Pro at $5/month | Medium |
| Medium | Low (import tool) | Low | Not verified (Cloudflare challenge) | Low without a publication (not verified) | Account | Low |
| daily.dev | Low (share a link) | Low to medium | `nofollow`, through an `api.daily.dev/r/` redirect | Spiky; one anecdote of 67k impressions in 2 days (not verified) | 250 reputation to post directly (docs conflict); Squads open to all | **Medium to high for traffic, none for SEO** |
| Lobsters | Low (link) | **High if done wrong** (invite tree, 25% rule) | `ugc noreferrer` (no referrer header, traffic shows as direct) | Site-wide 12k to 15k unique IPs per weekday (anecdotal) | Invite; new users cannot submit a never-seen domain for 70 days | Medium, later |
| freeCodeCamp News | High (original tutorial, editor review) | Low | **Followed** (no rel) on a high-authority domain | Not published; likely high long tail (not verified) | Application with 3 writing samples; "small percentage" approved | **High, one piece** |
| Hacker Noon | Medium (editor review) | Medium (link limits, permanent ban for later link edits) | `noopener noreferrer ugc`, adds `?ref=hackernoon.com` | Not published (not verified) | Account; canonical only to your own domain | Medium |
| Smashing Magazine | High (pitch, original, editor) | Low | Not checked | Not published | Outline pitch; original only; paid | Low to medium |
| CSS-Tricks | High (full draft) | Low | Not checked | Not published | Form; front-end tutorials; paid $300 to $400 (search snippet) | Low to medium |
| Echo JS | Very low | Low | `nofollow` | Low (not verified) | Account; "no commercial content" | Low to medium (JS articles only) |
| Lemmy, programming.dev | Low | Low to medium | `noopener nofollow` (lemmy-ui source) | c/programming: 28,868 subscribers, 3,533 active per month | Account; participate first | Medium |
| Changelog News | Very low | Low | Not checked | Not published | Account; no tutorials, no commercial products | Medium for "what I learned" pieces |
| JavaScript Weekly, Node Weekly (Cooperpress) | Very low | Low | **Followed** in the web archive of each issue | Not published | Submit form, editors choose | Medium for the Satori and Remix pieces |
| Slashdot | Very low | Low | Followed in story bodies | High if picked, odds very low | Account; editors pick "a fraction" | Low |
| Tildes | Low | Medium | Not checked | Small (not verified) | Invite from a member; email route reported closed | Low |
| LinkedIn articles and posts | Low | Low | Not verified | Depends on the owner's network (not verified) | Account | Low, optional |

---

## Google's guidance that applies to all of these

**Cross-domain canonical for syndication.** Google's "Fix canonicalization issues" page (last updated 2026-08-21) says: "The canonical link element is not recommended for those who want to avoid duplication by syndication partners, because the pages are often very different. The most effective solution is for partners to block indexing of your content." (https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting). The canonicalization page (last updated 2026-08-20) adds that a canonical preference "is a hint, not a rule" (https://developers.google.com/search/docs/crawling-indexing/canonicalization). **Doc**

What that means for GoodWatch: a self-set `canonical_url` on dev.to or Medium is the same article, so it is closer to "a page with the same content" than to a news partner's rewrite. It is still only a hint. GoodWatch's own pages are mostly "URL is unknown to Google" today (see idea 2 below), so the dev.to copy may be indexed first and chosen over the original. Two ways to live with that:

1. Publish on goodwatch.app first, wait until the URL Inspection tool shows it indexed, then cross-post with the canonical.
2. Or accept that dev.to may rank the article, and treat the dev.to copy as a followed link source whose job is to point at goodwatch.app pages.

**Link attributes are hints.** Google's 2019 post: "All the link attributes, sponsored, ugc, and nofollow, are treated as hints about which links to consider or exclude within Search." (https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify). **Doc.** So a `ugc` or `nofollow` link is not worthless for discovery, but a followed link is the stronger signal. The current "Qualify your outbound links" page (last updated 2025-12-10) recommends `ugc` for "user-generated content (UGC) links, such as comments and forum posts" (https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links).

**Guest posts and anchor text.** The link spam policy (spam policies page, last updated 2026-08-28) lists "links with optimized anchor text in articles, guest posts, or press releases distributed on other sites" as link spam (https://developers.google.com/search/docs/essentials/spam-policies). **Doc.** In practice: link with the brand name ("GoodWatch"), a bare URL, or the thing being linked ("the OG card benchmark", "the title page for Interstellar"). Never "best movie recommendation site". File 06 covers the rest of Google's link policies.

---

## dev.to (Forem)

- **Eligibility**: any account. **Doc**
- **Self-promotion rule** (Terms, section 11, Content Policy): "Users must make a good-faith effort to share content that is on-topic, of high-quality, and is not designed primarily for the purposes of promotion or creating backlinks. Posts must contain substantial content, they may not merely reference an external link that contains the full post." DEV "reserves the right to remove any content that it deems to be in violation of this policy" and to "restrict any user's ability to participate". (https://dev.to/terms). **Doc**
- **What gets removed**: link-only posts, posts that exist for promotion or backlinks, undisclosed affiliate links. Low-score posts are hidden from search: Forem's `skip_indexing?` returns true for unpublished posts, posts with a score below the site's minimum (unless featured), and any post with `score < -1`; those pages get `<meta name="robots" content="noindex">` and `nofollow`. **Verified (source code)**: forem/forem `app/models/article.rb` and `app/views/articles/show.html.erb`. The minimum dev.to uses is not public (the code default is 0). Fresh posts with 0 reactions checked on 2026-10-18 had no noindex.
- **Link rel**: body links carry `rel="noopener noreferrer"`, no `nofollow` or `ugc`. **Verified (live HTML)**, 2026-10-18.
- **Canonical**: the post's "Canonical URL" setting is written into the page as `<link rel="canonical" href="https://your-original/...">`, and the byline shows "Originally published at <domain>" as a plain link with no rel. **Verified (live HTML)** on a cross-posted article, 2026-10-18. RSS import that sets the canonical automatically exists in settings (not verified this session).
- **Traffic**: no founder-published per-post numbers found. Writers report the dev.to copy getting indexed in hours while a new personal domain waits weeks (anecdotal, dev.to posts found by search, not verified).
- **Effort**: low once the original exists. Paste Markdown, set canonical, pick 4 tags (for example `webdev`, `react`, `opensource`, `showdev`; the `showdev` tag exists with many pages of posts).
- **Do**: post the full article, not a teaser. Use the canonical setting. Link to the specific goodwatch.app pages and the GitHub files the article talks about. Reply to comments.
- **Don't**: post a "check out my site" announcement, post several pieces in one day, or pad posts with links.

## Hashnode

- **Eligibility**: any account; a free blog lives on a `hashnode.dev` subdomain. **Custom domains are a Pro feature**: "Get Hashnode Pro $ 5 / month · $ 50 / year ... Custom domain: Map your own domain to this publication in place of the default hashnode.dev subdomain." (https://hashnode.com/pro, read 2026-10-18). **Doc.** With a no-paid-services budget, a Hashnode blog on `blog.goodwatch.app` is out.
- **Moderation**: the Pro page says free publications are subject to "automoderation removal" of off-topic posts, while Pro posts are "shadow-banned (hidden from public feeds)" instead of deleted. **Doc.** The free GraphQL API was retired on 2026-05-13 because "Scrapers and spammers were abusing the free API" (https://hashnode.com/announcements/graphql-api). **Doc**
- **Link rel**: body links carry `rel="noopener ugc"`. **Verified (live HTML)** on a Hashnode-hosted post, 2026-10-18.
- **Canonical**: per-post canonical ("originally published") on the free plan: (not verified). Bulk import with canonical URLs from front matter is listed as a Pro feature.
- **Traffic**: (not verified).
- **Fit**: medium. Same effort as dev.to, weaker link (`ugc`), and the main reason to use Hashnode (own domain) costs money. Use only as a second cross-post if time allows.

## Medium

- **Canonical**: the import tool backdates the story and adds "a canonical link to make sure your SEO won't be penalized"; a manual canonical can be set from the three-dot menu, "Customize canonical link". (help.medium.com articles 214550207 and 360033930293; the pages returned 403 to my fetch, so this is from the help center's search snippets). **Doc, partly not verified.**
- **Distribution**: "by default, all stories published on Medium are eligible for general distribution via our recommendations algorithm (we do filter for spam, NSFW, etc)" (help.medium.com 360006362473, search snippet). **Doc, partly not verified.**
- **Link rel**: not verified. Every Medium page I tried returned a Cloudflare "Just a moment..." challenge. Developers report `nofollow ugc` on Medium links (secondary, not verified).
- **Fit**: low. Developer reach on Medium depends on getting into a publication; with an unverified (and widely reported nofollow) link, it ranks below dev.to.

## daily.dev

- **How content gets in**: three routes. (https://docs.daily.dev/docs/for-content-creators/how-to-get-featured). **Doc**
  - **Suggest a source** (an RSS feed): "Corporate and personal blogs are not eligible. Consider starting a Squad instead." (https://docs.daily.dev/docs/for-content-creators/suggest-new-source). A goodwatch.app blog cannot become a source.
  - **New Post** (direct posting): Community Picks was sunset in 2025 and replaced by "New Post" (https://docs.daily.dev/docs/key-features/community-picks). The docs conflict on who can use it: the featured page says "Open to all daily.dev users", the reputation page lists "Can contribute content directly via 'New Post'" at 250+ reputation (https://docs.daily.dev/docs/your-profile/reputation). New users start at 10. Treat 250 as the likely gate (not verified in the app).
  - **Squads**: "Open to all daily.dev users." In public Squads "by default, all members can post (with admin approval required)" (https://docs.daily.dev/docs/squads/public-squads). Large public Squads shown on daily.dev's home page on 2026-10-18: Node.js 41.4K members, NextJS 34K, WebDev 26.9K. **Verified (live HTML)**
- **Reputation math**: post upvote +10, comment upvote +50, "Post banned or removed: -100", and actions count only when they come from users with 250+ reputation. **Doc.** So the fastest honest route to 250 is a few genuinely useful comments.
- **What gets rejected** (content guidelines): "Content used primarily for self-promotion", "Clickbait or misleading content", "shortened or redirected URLs", sources without RSS; offenders may get "reduced reputation points" or restricted submissions. (https://docs.daily.dev/docs/for-content-creators/content-guidelines). **Doc**
- **Link rel**: the post page links to the article through `https://api.daily.dev/r/<id>` with `rel="noopener noreferrer nofollow"`. **Verified (live HTML)**, 2026-10-18. No SEO value; referral traffic only.
- **Traffic**: one Indie Hackers post reports "67k impressions in 2 days from a single daily.dev post" (title only; the page returned 403, so numbers and date are not verified; impressions are not clicks). daily.dev lets an author claim a post to see its traffic (docs, claiming ownership).
- **Fit**: good for reach among developers, zero link equity. Use for the most visual piece (OG cards).

## Lobsters

- **Eligibility**: invite only. "Users are considered 'new' for their first 70 days ... New users can't send invites, submit links to domains we haven't seen submitted before, flag stories and comments ... resubmit links that have been seen before". (https://lobste.rs/about). **Doc.** `lobste.rs/domains/goodwatch.app` returns 404 on 2026-10-18, so a new account could not submit a goodwatch.app article for 70 days. A github.com link would be allowed.
- **Getting an invite**: "If you wrote a link that was posted, please reach out in chat, we'd love to have you join the community." Inviters are accountable; the invitation tree is public "and helps identify voting rings". **Doc**
- **Self-promotion**: "It's great to have authors participate in the community, but not to exploit it as a write-only tool for product announcements or driving traffic to their work. As a rule of thumb, self-promo should be less than a quarter of one's stories and comments." **Doc**
- **Authored-by flag**: the submit form has a checkbox "I am the author of the story at this URL (or this text)" (`user_is_author`). **Verified (source code)**, lobsters/lobsters `app/views/stories/_form.html.erb`. Always tick it for your own work.
- **Link rel**: `rel="ugc noreferrer"`. **Verified (live HTML)**, 2026-10-18. `noreferrer` means Lobsters visits arrive with no referrer and show up as direct traffic in analytics.
- **Traffic**: the maintainer wrote in a public gist that weekdays see "typically 12-15k unique IPs", weekends about half (anecdotal, site-wide, undated).
- **Do**: get an invite through genuine participation, comment far more than you submit, tick "author", strip the site name from titles.
- **Don't**: ask strangers for invites to promote a product, or submit goodwatch.app links more than once in a while. A ban can also cost the inviter their invite rights.

## freeCodeCamp News

- **Eligibility**: read the style guide, which contains the application form; link three published articles; "only approve a small percentage" (https://www.freecodecamp.org/news/how-to-write-for-freecodecamp/, 2021). The style guide was last modified 2026-09-30 (https://www.freecodecamp.org/news/developer-news-style-guide/). **Doc**
- **Cross-posting**: "No Cross-Posting, Please ... we ask that you not cross-post it on open publishing sites like Medium." You may feature it on your own blog with "a canonical URL to point back to the original publication (freeCodeCamp's in this case)". **Doc.** So a freeCodeCamp piece must be original to freeCodeCamp.
- **Self-promotion**: "It is perfectly fine to have a one-sentence call-to-action for your product at the end of your tutorial. Don't open your tutorial with a link to your product, as this looks spammy." No branded accounts, no ghost writing. **Doc**
- **Link rel**: body links have no rel (followed); only the sponsored course box carries `rel="sponsored noopener noreferrer"`. **Verified (live HTML)**, 2026-10-18.
- **Traffic**: no public numbers found (not verified).
- **Fit**: the strongest single followed link in this list. Needs a real tutorial, not a launch story. The three writing samples can be the dev.to posts.

## Hacker Noon

- **Editorial review**: stories go through an editor. Backlink limits: "You can only add 1 link to your brand's websites/profiles per 300 words" for brands, and the same per 300 words "to your personal blog" for individuals (https://hackernoon.com/lite/backlink-limits, 2023-06-19). A help-center page found by search says 1 per 500 words and asks for 2 to 3 reputable outside links per brand link (not verified which is current). Search snippets of HN's editing protocol say changing or adding promotional links after publication is grounds for a permanent ban (not verified on the page itself).
- **Canonical**: "Canonical links to company domain must come from company account", and "We do not allow canonical links to blog networks or social networks"; personal domains are fine, subdomains on shared blog platforms are not (https://hackernoon.com/reposting-and-canonical-linking, 2023-06-19). A founder may publish under a personal profile with approval. **Doc.** So a canonical to `goodwatch.app/blog/...` is possible, to `*.hashnode.dev` it is not.
- **Link rel**: body links carry `rel="noopener noreferrer ugc"` and get `?ref=hackernoon.com` appended. **Verified (live HTML)**, 2026-10-18.
- **Fit**: medium. Wider non-developer tech audience, `ugc` link, real editing effort. A second-wave option for the MCP story.

## Smashing Magazine and CSS-Tricks

- **Smashing**: "The article is an original piece of work for Smashing Magazine, not something you have published elsewhere." Pitch an outline of 200 to 300 words through the contact form; "pieces full of links to your product, or which are a walkthrough of how to use your product, will be rejected." Authors get an honorarium. (https://www.smashingmagazine.com/write-for-us/). **Doc.** Fit: a performance piece (scripts after first paint) could work, written as a general technique.
- **CSS-Tricks**: the guest writing page (modified 2026-06-16) says "We have a budget to pay you for your work" and still takes guest writers (https://css-tricks.com/guest-writing-for-css-tricks/). Search snippets of the same page give $300, up to $400, and a front-end, "How to X" focus, and say no decision is made without a full draft (not verified on the page). Fit: low to medium; Satori's CSS subset is the only GoodWatch topic that is really front-end.
- Link rel on both: not checked.

## Echo JS

- "Echo JS is a community-driven news site entirely focused on JavaScript development, HTML5, and front-end news." Rules: article title only, no shortened URLs, original content, English, "No commercial content or libraries (even with free demo)." (https://www.echojs.com/about). **Doc**
- **Link rel**: `rel="nofollow"`. **Verified (live HTML)**, 2026-10-18.
- **Fit**: low effort, low value. A free, open-source, MIT-licensed project's technical write-up is probably not "commercial", but that is a judgement call (not verified).

## Lemmy: programming.dev

- **Communities** (API, 2026-10-18): c/programming 28,868 subscribers and 3,533 active users per month; c/webdev 5,887 and 389; c/opensource 6,877 and 1,998; c/javascript 2,836 and 64. c/programming's sidebar: "Keep content related to programming in some way" and "Cross posting is strongly encouraged in the instance." **Verified (API)**
- **Self-promotion**: the instance Code of Conduct page blocked my fetch (403), so instance-level promotion rules are not verified. File 02 covers lemmy.world's rules.
- **Link rel**: lemmy-ui sets `relTags = "noopener nofollow"`. **Verified (source code)**, LemmyNet/lemmy-ui `src/shared/utils/config.ts`.
- **Fit**: medium. Real readers, low ceremony, nofollow. Post as a participant with a history, not a fresh account.

## Changelog News

- "Submitting other people's work is encouraged. Submitting your own work is also encouraged." Not wanted: "How-to's and tutorials", "Commercial products or services" (sponsorship suggested instead). (https://changelog.com/news/submit). **Doc**
- **Fit**: medium for an essay-style "what I learned" piece (indexing, or one hour at 500 page views per second). Link rel not checked.

## JavaScript Weekly, Node Weekly and other Cooperpress newsletters

- "Just fill in the form below and your link will be sent across to our editorial team for review ... we make no guarantee of inclusion." (https://cooperpress.com/submit/). **Doc.** Self-submission is not addressed.
- **Link rel**: the web archive of a JavaScript Weekly issue links straight to articles with no rel. **Verified (live HTML)**, 2026-10-18.
- **Fit**: medium for the Satori child-process piece (Node Weekly) and the scripts-after-paint piece (JavaScript Weekly or React Status). One form submission per article.

## Slashdot

- "We try to select the most interesting, timely, and relevant submissions, but can only run a fraction of those submitted." "We'd rather you didn't submit press releases, at least not ones that sound like press releases!" (https://slashdot.org/faq/editorial.shtml). **Doc**
- **Link rel**: story summaries link out with no rel. **Verified (live HTML)**, 2026-10-18.
- **Fit**: low odds. Only worth one submission if a piece has a newsworthy angle (for example, Google indexing 1 of 50 sampled URLs of a working site).

## Tildes

- "If you have your own site/project/channel/etc. that you'd like to share on Tildes, that's generally fine (in moderation), but it shouldn't be the primary reason that you post on the site. Tildes is a community, not a free advertising platform." (https://docs.tildes.net/policies/code-of-conduct). **Doc**
- **Invites**: from existing members. A 2026 community thread says the old email route is no longer a way in because of LLM-generated requests (community thread, not verified as policy).
- **Fit**: low. Only if the owner already reads Tildes.

## LinkedIn articles and posts

- Brief: LinkedIn suits the owner's professional network, not developer discovery. Claims that posts with outside links get less reach are common but I found no LinkedIn statement (not verified). Link attributes not verified. freeCodeCamp's style guide calls LinkedIn "a walled garden (that is not indexed by Google)", which is that editor's view, not LinkedIn's (not verified). Optional: a short native post that summarizes one article and puts the link in the post.

---

## Does GoodWatch need its own blog?

**Option for the owner, not a decision.**

Arguments for a `/blog` on goodwatch.app:

- Links inside an article on goodwatch.app to title pages, `/hot-on-socials` or share lists are internal links, which Google reads as normal site structure. The same links on dev.to are external links from a big domain. Having both is better than either alone.
- dev.to, Hacker Noon and Medium all accept a canonical pointing at your own domain; Hacker Noon accepts only that, not a hashnode.dev subdomain.
- Each followed backlink from dev.to, freeCodeCamp or a newsletter can point at a page Google does not yet know, which helps discovery of a site whose sample is "URL is unknown to Google" for 46 of 50 URLs.

Arguments against or for later:

- goodwatch.app pages are slow to be found today, so the dev.to copy may be indexed and chosen first even with a canonical.
- The repo already publishes the raw material under `docs/benchmarks` and `docs/research` on GitHub, but those are engineering notes, not articles. (sibling file 05 reports GitHub links as nofollow; not rechecked here.)

**Minimum viable version** (if the owner wants one):

1. `goodwatch-webapp/app/routes/blog._index.tsx` and one route per post, written as TSX like the existing `about.tsx` and `how-it-works.tsx`. No new Markdown dependency is needed for three to five posts (the webapp has none today).
2. Each post: title, date, author name, `<link rel="canonical">` to itself, OG card, `Article` JSON-LD, and links into real GoodWatch pages.
3. An RSS feed at `/blog/rss.xml`. dev.to and Hashnode can import from it; daily.dev will not accept it as a source.
4. Add `/blog/*` to the sitemap generator (`docs/sitemap.md`) so the weekly checked sitemap lists them.
5. A footer link to `/blog`.

Cheaper alternative: skip `/blog`, publish originals on dev.to only, and make every article link to the goodwatch.app pages it discusses. Less SEO value for the article itself, near-zero setup.

---

## Article ideas tied to what GoodWatch built

Facts below were checked in the repo (read only) on 2026-10-18.

1. **"Open Graph cards with Satori and resvg without stalling the Node server"** (Node Weekly, dev.to, daily.dev; also the freeCodeCamp tutorial candidate). Source: `docs/benchmarks/viral-spike-og-images.md` (2026-10-04). A title card on a cache miss cost 88 ms of main-thread CPU with satori and the PNG encoder on the main thread; after moving the render into a child process it costs 25 ms on the main thread (354 ms in the child). Cards went from PNG (median 554 KB) to JPEG (median 132 KB, all 60 sampled title cards under 150 KB). At 10 cold cards per second the old setup had no bound on its queue; the new one answers about 3 cards per second on a 4-core host and serves a generic card after 4 seconds. Code: `goodwatch-webapp/app/server/card-renderer/`, routes `og.$.tsx` and friends. Links to use: the benchmark doc on GitHub, a live `/og/...png` card, a title page.
2. **"Google knows 120 of my URLs and indexed one: a weekly record"** (Changelog News, dev.to, Slashdot long shot). Source: `docs/research/discovery-search/index-record.md` and `gsc-page-indexing-daily-2026-10-11.csv`. Search Console's page-indexing report shows 119 not indexed and 1 indexed from 2026-09-30 to 2026-10-04. The fixed 50-URL sample on 2026-10-15: 1 "Submitted and indexed" (the start page), 3 "Crawled - currently not indexed", 46 "URL is unknown to Google". The record runs as a GitHub Actions workflow every Saturday. Write it as "what I measured and what I changed", with a follow-up post when the numbers move. Honest and useful for other small sites.
3. **"A remote MCP server with OAuth for a movie site: ChatGPT and Claude as clients"** (dev.to, Hacker Noon, freeCodeCamp alternative). Source: `docs/implementation/mcp-authorization.md`, `mcp-poster-grid/README.md`, `mcp-write-tools.md`. Better Auth MCP, CIMD and OAuth Provider packages pinned at 1.7.7, authorization code with PKCE and refresh grants, dynamic client registration, `mcp:read` and `mcp:write` scopes, signing keys rotated after 30 days; MCP Apps poster cards rendered in a sandboxed iframe; batch writes with undo by `batch_id`. Links: `/use-with-ai`, the repo folder.
4. **"Starting scripts after the first paint in React Router: Lighthouse mobile 83 to 97"** (JavaScript Weekly, Smashing pitch, dev.to). Source: commit `745f9525` (2026-10-18): title pages drop module preloads and start the app after the hero backdrop paints, with early taps replayed. Local production builds, median of five, mobile: Interstellar 83 to 97 (FCP 3.16 to 1.53 s, LCP 3.69 to 2.44 s), Breaking Bad 80 to 95, The Simpsons 78 to 92. Links: the Interstellar and Breaking Bad title pages themselves.
5. **"One hour at 500 page views per second on four-core hosts"** (dev.to, Lobsters later, Changelog News). Source: `docs/benchmarks/viral-spike-one-hour.md` (2026-10-10) and `viral-spike-page-cache.md`. 1,799,807 documents and OG images in 3,600 seconds with no failed request; an in-process page cache answers a stored page in 0.5 to 0.8 ms of main-thread time against 14 to 63 ms for a render; the doc also says what it did not prove (whole page views at 500 per second). Self-hosted stack (Coolify, Valkey, CrateDB, Qdrant) is the hook.

Also possible later: the search ranker port (`docs/prototypes/search-arena/results/simplify/HOW-IT-WORKS.md`: local CPU embedding models, NDCG@10 on holdout from .754 to .780, simplicity score 394 to 218) as a "replacing a 13-module ranker with one module" piece.

---

## Recommended top 3 moves, in order

1. **Write idea 1 (OG cards) as the first original and cross-post it to dev.to with a canonical.** If the owner wants a `/blog`, publish there first and wait for URL Inspection to show it indexed; otherwise publish on dev.to directly. dev.to body links are followed (verified), the topic is concrete and visual, and it links naturally to live cards and title pages. Then submit the same URL to Node Weekly (one form) and share it in daily.dev's WebDev or Node.js public Squad (admin approval; nofollow, traffic only). Effort: one article plus about 30 minutes of distribution.
2. **Apply to freeCodeCamp News with a tutorial version of a different topic** (the MCP OAuth server, or a general "OG images with Satori in a worker process" tutorial if idea 1 stayed short). Use the dev.to posts as the three writing samples. One followed link from freeCodeCamp is worth more than any other item here, and the one-sentence CTA plus in-body links to the repo are allowed. It must be original to freeCodeCamp, so don't cross-post it.
3. **Publish idea 2 (indexing record) on dev.to and submit it to Changelog News**, then post it in programming.dev c/programming after a few weeks of commenting there. It is the most broadly interesting story and it repeats: each weekly change is a natural follow-up. Lobsters waits until the owner has an invite and 70 days, with "author" ticked and under a quarter of activity being self-promotion.

Skip for now: Hashnode (custom domain is paid, links are `ugc`), Medium (unverified, likely nofollow), Tildes and Slashdot (low odds), Smashing and CSS-Tricks (only if the owner enjoys long-form editing; both want original pieces).

---

## Sources

Platform rules and docs: https://dev.to/terms, https://hashnode.com/pro, https://hashnode.com/announcements/graphql-api, https://docs.daily.dev/docs/for-content-creators/how-to-get-featured, https://docs.daily.dev/docs/for-content-creators/suggest-new-source, https://docs.daily.dev/docs/for-content-creators/content-guidelines, https://docs.daily.dev/docs/your-profile/reputation, https://docs.daily.dev/docs/key-features/community-picks, https://docs.daily.dev/docs/squads/public-squads, https://lobste.rs/about, https://www.freecodecamp.org/news/how-to-write-for-freecodecamp/, https://www.freecodecamp.org/news/developer-news-style-guide/, https://hackernoon.com/lite/backlink-limits, https://hackernoon.com/reposting-and-canonical-linking, https://www.smashingmagazine.com/write-for-us/, https://css-tricks.com/guest-writing-for-css-tricks/, https://www.echojs.com/about, https://changelog.com/news/submit, https://cooperpress.com/submit/, https://slashdot.org/faq/editorial.shtml, https://docs.tildes.net/policies/code-of-conduct, https://programming.dev/api/v3/community?name=programming, help.medium.com articles 214550207, 360033930293, 360006362473 (search snippets only).

Source code: forem/forem (`app/models/article.rb`, `app/views/articles/show.html.erb`, `app/models/settings/user_experience.rb`), lobsters/lobsters (`app/views/stories/_form.html.erb`), LemmyNet/lemmy-ui (`src/shared/utils/config.ts`).

Google: https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting, https://developers.google.com/search/docs/crawling-indexing/canonicalization, https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links, https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify, https://developers.google.com/search/docs/essentials/spam-policies.

Anecdotal: Indie Hackers post "67k impressions in 2 days from a single daily.dev post" (title only, page blocked); the Lobsters maintainer's public gist on site traffic (undated).

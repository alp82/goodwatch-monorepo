# Google's policies on links, crawling and indexing, applied to GoodWatch

Researched 2026-10-18. Every quote below was read from the live page on that date (raw HTML fetched, text extracted, quotes copied). "Last updated" is the date shown at the foot of the page. Google's support.google.com help pages show no last-updated date, so for those the fetch date is given.

Labels used:

- **Doc**: Google documentation or the Search Central blog.
- **Spokesperson**: something a Googler said in a video, podcast or social post. Not documentation.
- **Not verified**: I could not confirm it from a primary source.

---

## 1. Link spam and related spam policies

Source: Spam policies for Google web search, https://developers.google.com/search/docs/essentials/spam-policies (last updated 2026-08-28). **Doc**

Definition: "Link spam is the practice of creating links to or from a site primarily for the purpose of manipulating search rankings."

The complete list of examples, verbatim:

- "Buying or selling links for ranking purposes. This includes:"
  - "Exchanging money for links, or posts that contain links"
  - "Exchanging goods or services for links"
  - "Sending someone a product in exchange for them writing about it and including a link"
- "Excessive link exchanges ("Link to me and I'll link to you") or partner pages exclusively for the sake of cross-linking"
- "Using automated programs or services to create links to your site"
- "Requiring a link as part of a Terms of Service, contract, or similar arrangement without allowing a third-party content owner the choice of qualifying the outbound link"
- "Text advertisements or text links that don't block ranking credit"
- "Advertorials or native advertising where payment is received for articles that include links that pass ranking credit, or links with optimized anchor text in articles, guest posts, or press releases distributed on other sites."
- "Low-quality directory or bookmark site links"
- "Keyword-rich, hidden, or low-quality links embedded in widgets that are distributed across various sites"
- "Widely distributed links in the footers or templates of various sites"
- "Forum comments with optimized links in the post or signature"
- "Creating low-value content primarily for the purposes of manipulating linking and ranking signals"

The carve-out: "Google does understand that buying and selling links is a normal part of the economy of the web for advertising and sponsorship purposes. It's not a violation of our policies to have such links as long as they are qualified with a rel="nofollow" or rel="sponsored" attribute value to the <a> tag."

Other policies on the same page that matter for a small site:

- **Site reputation policy** (the page now calls it this; it used to be "site reputation abuse"). It "applies where third-party content is published on a host site mainly because of that host's already-established ranking signals". For GoodWatch this mostly matters in one direction. Paying to put a GoodWatch article on a big site so it ranks or links back is the pattern this policy targets. The page also says: "Google generally applies a presumption that individual pages (including new pages) match the overall quality of other pages on the domain."
- **Scaled content abuse**: "when many pages are generated for the primary purpose of manipulating search rankings and not helping users ... no matter how it's created." Examples include "Using generative AI tools or other similar tools to generate many pages without adding value for users" and "Scraping feeds, search results, or other content to generate many pages". This matters for GoodWatch's templated title, person and genre pages. Each one has to add something beyond the TMDB/IMDb data it is built on. The **Scraping** section also lists "Creating sites dedicated to embedding or compiling content ... from other sites, without substantial added value to the user".
- **Expired domain abuse**: "where an expired domain name is purchased and repurposed primarily to manipulate search rankings by hosting content that provides little to no value to users." Examples include "Casino-related content on a former elementary school site". For GoodWatch: don't buy old film-blog domains and redirect them to goodwatch.app, or build on them, to inherit their links.
- **User-generated spam**: "Spammy accounts on hosting services that anyone can register for", "Spammy posts on forum threads". This is a reason to keep public user lists and profiles out of the index, or moderate them, if they ever become indexable.
- **Doorway abuse** includes "Creating substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy". This is worth knowing for genre × provider × year combination pages.

## 2. Qualifying outbound links, and whether nofollow links still help

Source: Qualify your outbound links to Google, https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (last updated 2025-12-10). **Doc**

- `rel="sponsored"`: "Mark links that are advertisements or paid placements (commonly called paid links) with the sponsored value."
- `rel="ugc"`: "We recommend marking user-generated content (UGC) links, such as comments and forum posts, with the ugc value."
- `rel="nofollow"`: "Use the nofollow value when other values don't apply, and you'd rather Google not associate your site with, or crawl the linked page from, your site."
- On crawling: "Links marked with these rel attributes will generally not be followed. Remember that the linked pages may be found through other means, such as sitemaps or links from other sites, and thus they may still be crawled."

Source: Evolving "nofollow", https://developers.google.com/search/blog/2019/09/evolving-nofollow-new-ways-to-identify (posted 2019-09-10, Danny Sullivan and Gary Illyes). **Doc**

- "All the link attributes (sponsored, ugc, and nofollow) are treated as hints about which links to consider or exclude within Search." (Google uses dashes where this has parentheses.)
- Why: "Links contain valuable information that can help us improve search, such as how the words within links describe content they point at."
- Timing: "For crawling and indexing purposes, nofollow will become a hint as of March 1, 2020."
- How Google usually treats them: "In most cases, the move to a hint model won't change the nature of how we treat such links. We'll generally treat them as we did with nofollow before and not consider them for ranking purposes."

What this means for GoodWatch links from Reddit, X, Product Hunt, GitHub and Wikipedia:

- I checked two of these on 2026-10-18. Wikipedia external links carry `rel="mw:ExtLink nofollow"` (seen on en.wikipedia.org/wiki/Letterboxd). GitHub README links carry `rel="nofollow"` (seen on the main "awesome" index README). **Not verified here**: Reddit, X and Product Hunt. They are widely reported to use nofollow and/or ugc, but my fetches were blocked.
- Google documents two things. Such links are hints, so Google *may* use them for crawling and discovery. They "will generally not be followed" and are generally not used "for ranking purposes". Google does not document how often a nofollow or ugc hint is used for discovery. Treat any discovery benefit as possible, not dependable.
- Their main documented value is indirect. People click them, some of those people write about the site or link to it from their own pages without nofollow, and the URL becomes known.

## 3. Why directories, bought links and link swaps don't help

- "Low-quality directory or bookmark site links", paid links and "Excessive link exchanges" are all named link spam (section 1).
- Source: Get your website on Google, https://developers.google.com/search/docs/fundamentals/get-on-google (last updated 2025-12-10). **Doc** One common reason a site is missed: "Your site isn't linked to by other sites on the web. See if you can get your site linked to by other sites (but please don't pay them to link to you; that could be considered a violation of Google's spam policies)."
- Source: December 2022 link spam update, https://developers.google.com/search/blog/2022/12/december-22-link-spam-update (posted 2022-12-14). **Doc**
  - "Today, we're leveraging the power of SpamBrain to neutralize the impact of unnatural links on search results."
  - SpamBrain "can now detect both sites buying links, and sites used for the purpose of passing outgoing links."
  - "Ranking may change as spammy links are neutralized and any credit passed by these unnatural links are lost."
  - "Our algorithms and manual actions aim to nullify these unnatural links at scale".
- Source: A reminder on qualifying links and our link spam update, https://developers.google.com/search/blog/2021/07/link-tagging-and-link-spam-update (posted 2021-07-26). **Doc**
  - "Links are one of the ways Google understands what content may be helpful to searchers, and they can be good for sites to receive, as long as they're well deserved."
  - "Focusing on producing high quality content and improving user experience always wins out compared to manipulating links. Promote awareness of your site using appropriately tagged links".
- Source: Google Search spam updates and your site, https://developers.google.com/search/updates/spam-updates (last updated 2025-12-10). **Doc** "when our systems remove the effects spammy links may have, any ranking benefit the links may have previously generated for your site is lost. Any potential ranking benefits generated by those links cannot be regained."
- Source: Penguin is now part of our core algorithm, https://developers.google.com/search/blog/2016/09/penguin-is-now-part-of-our-core (posted 2016-09-23). **Doc** "Penguin now devalues spam by adjusting ranking based on spam signals, rather than affecting ranking of the whole site."

Ignoring versus penalizing:

- Source: Links report help, https://support.google.com/webmasters/answer/9049606 (fetched 2026-10-18). **Doc** "For known spam sites, Google typically will ignore the links, but you might want to remove or disavow these links."
- Source: Manual actions report, https://support.google.com/webmasters/answer/9044175 (fetched 2026-10-18). **Doc** Under "Unnatural links to your site": "Google has detected a pattern of unnatural, artificial, deceptive, or manipulative links pointing to your site. Buying links or participating in link schemes in order to manipulate ranking in Google Search results is a violation of our spam policies. This can result in some or all of your site getting a manual action." A manual action is triggered by a *pattern*, and you get a notice in Search Console. Google does not say a few junk links cause one.
- Source: Disavow links to your site, https://support.google.com/webmasters/answer/2648487 (fetched 2026-10-18). **Doc**
  - "In most cases, Google can assess which links to trust without additional guidance, so most sites will not need to use this tool."
  - Disavow only if "You have a considerable number of spammy, artificial, or low-quality links pointing to your site, AND The links have caused a manual action, or likely will cause a manual action".
  - "This is an advanced feature and should only be used with caution."
  - "The disavow links tool does not support Domain properties." GoodWatch uses a domain property (sc-domain), so it could not use the tool without also adding a URL-prefix property. It should not need it.

## 4. What earned links look like, per Google

- Source: SEO Starter Guide, https://developers.google.com/search/docs/fundamentals/seo-starter-guide (last updated 2025-12-10). **Doc**
  - "Google primarily finds pages through links from other pages it already crawled. In many cases, these are other websites that are linking to your pages. Other sites linking to you is something that happens naturally over time, and you can also encourage people to discover your content by promoting your site."
  - The section "Promote your website": "Effectively promoting your new content will lead to faster discovery by those who are interested in the same subject, and also by search engines." It lists "Social media promotion", "Community engagement", "Advertisement, both offline and online", and "Word of mouth".
  - "One of the most effective and lasting ways is word of mouth ... This can take time, and usually you need to invest some time and effort in other practices first, such as community engagement."
  - The warning: "As with everything in life, you can overdo promoting your site and actually harm it: people may get fatigued of your promotions, and search engines may perceive some of the practices as manipulation of search results."
  - "Creating content that people find compelling and useful will likely influence your website's presence in search results more than any of the other suggestions in this guide."
  - On links in general: "PageRank uses links and is one of the fundamental algorithms at Google, there's much more to Google Search than just links."
- The 2021 blog post's "well deserved" and "Promote awareness of your site using appropriately tagged links" lines (section 3) are the current documented framing of earned links.
- **Not verified**: the older line "the best way to get other sites to create high-quality, relevant links to yours is to create unique, relevant content that can naturally gain popularity in the Internet community" came from the retired Webmaster Guidelines link-schemes page. I could not find it in current Google documentation, so don't quote it as current policy.

## 5. Crawl budget, crawl demand and discovery

Source: Optimize your crawl budget, now at https://developers.google.com/crawling/docs/crawl-budget (the old URL .../large-site-managing-crawl-budget redirects there; last updated 2026-07-22). **Doc**

- Who it is for: large sites (1M+ pages), medium sites (10k+) with daily changes, and "Sites with a large portion of their total URLs classified by Search Console as Discovered - currently not indexed". GoodWatch is in this third group.
- "For Googlebot, demand varies based on a site's size, update frequency, page quality, and relevance, compared to other sites."
- "Perceived inventory: Without guidance from you, Google tries to crawl all or most of the URLs that it knows about on your site. If many of these URLs are duplicates, or you don't want them crawled ... this wastes a lot of Google crawling time on your site. This is the factor that you can positively control the most."
- "Popularity: URLs that are more popular on the Internet tend to be crawled more often to keep them fresher in our systems."
- "Even if the crawl capacity limit isn't reached, if crawl demand is low, Google will crawl your site less."
- "How do I get more crawl budget?" One of two answers is to "Optimize your content's quality ... for Google Search, this includes things like popularity, overall user value, content uniqueness, and serving capacity."
- "Don't use noindex, as Google will still request, but then drop the page when it sees a noindex meta tag or header in the HTTP response, wasting crawling time."
- Older context, What Crawl Budget Means for Googlebot, https://developers.google.com/search/blog/2017/01/what-crawl-budget-means-for-googlebot (posted 2017-01-16; Google flags it as possibly outdated). **Doc** "if a site has fewer than a few thousand URLs, most of the time it will be crawled efficiently." It also says "having many low-value-add URLs can negatively affect a site's crawling and indexing", with "Low quality and spam content" in the list.

Source: Page indexing report help, https://support.google.com/webmasters/answer/7440203 (fetched 2026-10-18). **Doc**

- "Discovered - currently not indexed: The page was found by Google, but not crawled yet. Typically, Google wanted to crawl the URL but this was expected to overload the site; therefore Google rescheduled the crawl. This is why the last crawl date is empty on the report."
- "Crawled - currently not indexed: The page was crawled by Google but not indexed. It may or may not be indexed in the future; no need to resubmit this URL for crawling."
- "Google needs a way to find a page in order to crawl it. This means that it must be linked from a known page, or from a sitemap."

Source: In-depth guide to how Google Search works, https://developers.google.com/search/docs/fundamentals/how-search-works (last updated 2025-12-18). **Doc**

- "Other pages are discovered when Google extracts a link from a known page to a new page ... Still other pages are discovered when you submit a list of pages (a sitemap) for Google to crawl."
- "Google doesn't accept payment to crawl a site more frequently, or rank it higher."
- Common indexing issues include "The quality of the content on page is low".

Source: Sitemaps overview, https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview (last updated 2025-12-10). **Doc** You might need a sitemap if "Your site is new and has few external links to it. Googlebot and other web crawlers crawl the web by accessing URLs found in previously crawled pages. As a result, Googlebot might not discover your pages if no other sites link to them." Also: a sitemap "doesn't guarantee that all the items in your sitemap will be crawled and indexed."

Source: Link best practices, https://developers.google.com/search/docs/crawling-indexing/links-crawlable (last updated 2025-12-10). **Doc** "Google uses links as a signal when determining the relevancy of pages and to find new pages to crawl."

**Spokesperson**: Search Off the Record episode 79, "Crawling smarter, not harder", 2024-08-08, Gary Illyes with John Mueller and Lizzi Sassman. The official transcript PDF is linked from https://search-off-the-record.libsyn.com/website/transcript-for-crawling-smarter-not-harder (Google's goo.gle/sotr079-transcript redirects there).

- Gary Illyes [00:04:42]: "generally if the content of a site is of high quality and it's helpful and people like it in general, then Googlebot--well, Google--tends to crawl more from that site ... on the flip side, if we are not crawling much or we are gradually slowing down with crawling, that might be a sign of low-quality content or that we rethought the quality of the site."
- Gary Illyes [00:10:26]: "there are two parts to this. One is what the server can handle, and then there's the quality aspect to it. The content on the site has to be of high quality and useful for users or helpful for users. And then the Search demand for crawling would increase and then we would crawl more potentially."

Separating documentation from folklore:

- **Documented**: links are how Google discovers URLs, and external links matter most for new sites with few of them. Crawl demand depends on popularity, quality, relevance and staleness. Quality and popularity are the documented ways to get more crawl budget.
- **Documented, but loosely**: "popularity" is never defined as "backlinks". Links are the obvious reading, but Google does not say so.
- **Folklore**: "each backlink raises your crawl budget by X", "link velocity", and "DA/DR scores". None of these are in Google documentation.
- **A tension worth noting**: the help page blames "Discovered - currently not indexed" on expected server overload. Google's crawl budget guide and the Illyes podcast tie low crawl demand to quality and popularity. For a 1,100-URL site on a healthy server, overload is unlikely. The Crawl Stats host status and response times can confirm that, which points back to demand: quality, popularity, and links.

## 6. Links on noindex and nofollow pages

Source: Robots meta tag, https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (last updated 2026-03-24). **Doc**

- `nofollow`: "Do not follow the links on this page. If you don't specify this rule, Google may use the links on the page to discover those linked pages."
- `none`: "Equivalent to noindex, nofollow."
- `noindex`: "Do not show this page, media, or resource in search results."
- "these settings can be read and followed only if crawlers are allowed to access the pages that include these settings."
- The 2019 hint change was announced for link `rel` attributes. Google does not say whether page-level meta `nofollow` is also only a hint. **Not verified**: treat it as a directive.

**Spokesperson**: John Mueller, English Google Webmaster Central office-hours hangout, published 2017-12-15 on the Google Search Central YouTube channel, https://www.youtube.com/watch?v=9GNg8R-X8LQ&t=54m51s. I confirmed the video title, channel and date through YouTube's metadata. The transcript below is Search Engine Roundtable's (https://www.seroundtable.com/google-long-term-noindex-follow-to-nofollow-24990.html, 2017-12-28); I did not check it against the audio myself.

- "if we see the noindex there for longer than we think this this page really doesn't want to be used in search so we will remove it completely. And then we won't follow the links anyway. So in noindex and follow is essentially kind of the same as a noindex, nofollow. There's no really big difference there in the long run."
- Asked how long that takes, Mueller tweeted (2017-12-27): "It depends".

Conclusion for GoodWatch:

- Shared list pages and profiles use `noindex, nofollow`. A link to one of them can at most get Google to fetch that page. Then Google drops the page (noindex) and, per the docs, does not use its links to discover title pages (nofollow). The crawl budget doc adds that crawling noindex pages wastes crawl time.
- So social shares of list URLs do **not** help title pages get discovered or crawled through Google. They help only through people: visitors who click through and later link to title pages themselves.
- Switching lists to `noindex, follow` would let Google use their links for a while. Per Mueller (spokesperson), that ends once the page is dropped. It is not a durable fix.
- Durable options: make the most-shared URLs indexable pages (title, person and genre pages, or a curated, quality-checked public list type). Or make sure share cards and posts also link straight to the title pages.

## 7. Anchor text, link velocity and launch spikes

- **Anchor text (Doc)**: "links with optimized anchor text in articles, guest posts, or press releases distributed on other sites" and "Forum comments with optimized links in the post or signature" are link spam (spam policies, section 1). The Links report help tells you to check "Top linking text" to "Confirm that the link text is what you expect, and not spammy text." Natural anchors (the brand name, the bare URL, a title name) are what that check expects to see. The link best practices doc covers anchor text for your own links ("descriptive, reasonably concise, and relevant").
- **Link velocity and launch spikes**: Google's documentation does not mention link velocity, link growth rate, or sudden spikes from a launch such as a Hacker News front page or a Product Hunt day. I found nothing primary saying a spike is good, bad or neutral.
  - The closest documented points: SpamBrain targets *bought* links and link-passing sites, not timing. The starter guide warns that you "can overdo promoting your site".
  - **Not verified**: Search Engine Journal reports Mueller and Illyes dismissing "link velocity" as a concept. I could not find the primary statement, so don't rely on it.

## 8. Measuring links and their effect with free tools

- **Links report (Doc)**, https://support.google.com/webmasters/answer/9049606. It shows Top linked pages, Top linking sites, Top linking text, and internal links.
  - "This report isn't a comprehensive list of every link on your site. It shows a sample".
  - "The report includes links that Google has found over time. These links may have since been removed".
  - "The report doesn't specify if a link is marked as nofollow."
  - Export has a "Latest links" slice: "The most recently discovered links to your site (up to 100,000 rows), sorted by discovery date."
  - Data is grouped by root domain.
  - **Delay**: Google does not document how long a new link takes to appear. Expect days to weeks; measure it yourself.
- **Performance report (Doc)**, https://support.google.com/webmasters/answer/7576553. It shows clicks, impressions, CTR and position by Queries, Pages, Countries, Devices, Search appearance and Dates. You can filter or compare by page. "The newest data can be preliminary".
- **Page indexing report (Doc)**, https://support.google.com/webmasters/answer/7440203. It shows indexed versus not indexed counts and the reasons. "Note that the list of example URLs in the report is limited to 1,000 items". Use URL Inspection for a single page.
- **Crawl Stats report (Doc)**, https://support.google.com/webmasters/answer/9679690. It is available for Domain properties. It shows requests by response, file type, Googlebot type and purpose: "Discovery: The URL requested was never crawled by Google before. Refresh: A recrawl of a known page." Also: "If you recently added a lot of new content, or submitted a sitemap, you should ideally see a bump in discovery crawls". Google says sites under about 1,000 pages shouldn't need the report. GoodWatch's case (low crawl demand) is an exception worth watching.
- **Bing Webmaster Tools**: free. I could not read Bing's help articles (bing.com/webmasters/help renders by script). The tool's own UI strings in the page source include "Backlinks For Your Site", "Backlinks To Any Site", "Referring domains", "Top anchor texts", "Disavow", and "Analyze your websites' backlink profile with up to two other sites backlinks". It also offers "GSC Import Sites" to add sites from Search Console. **Partly verified** (UI strings, not docs).
- **IndexNow**: the protocol's own registry, https://www.indexnow.org/searchengines.json (fetched 2026-10-18), lists bing, yandex, seznam, naver, yep, internetarchive and amazonbot. **Google is not listed**, and Google's Search Central documentation does not mention IndexNow. Google's own push API is limited: "The Indexing API can only be used to crawl pages with either JobPosting or BroadcastEvent embedded in a VideoObject" (https://developers.google.com/search/apis/indexing-api/v3/quickstart). For Google, use the sitemap and internal and external links.

---

## Rules and pitfalls for GoodWatch

Do:

1. Promote in places where people talk about films and TV: subreddits, Letterboxd and film communities, Product Hunt, Hacker News, GitHub (for the MCP server). The SEO Starter Guide names "Social media promotion" and "Community engagement". Those links are mostly nofollow or ugc. That's fine: their documented value is people, and discovery as a hint.
2. Link shares to indexable pages. Shared list and profile pages are `noindex, nofollow`, so Google won't follow their links to title pages. Make share cards, posts and launch announcements also link to title, person or genre pages, or the home page.
3. Pitch genuinely useful pages that others want to cite: rating grids, episode scores, "hot on socials" and data write-ups. Write to journalists, bloggers and newsletter editors with no payment and no conditions ("well deserved" links, 2021 blog post).
4. Keep the sitemap complete and current, with `<lastmod>`. Google calls this "adequate" for most sites.
5. Make every templated page add value beyond the TMDB/IMDb data: GoodWatch scores, analysis and fingerprints. This guards against scaled content and scraping concerns, and Google ties crawl demand to quality.
6. Use `rel="sponsored"` on any paid or affiliate outbound link, and `rel="ugc"` (or nofollow) on links users can post.
7. Keep low-value URLs out of the inventory (filters, sorts, duplicates). Google calls perceived inventory "the factor that you can positively control the most".

Don't:

8. Don't buy links, sponsored posts, link packages or "guest posts with a link". Don't trade a free account or anything else of value for a link. All of these are named link spam, and SpamBrain neutralizes them.
9. Don't submit to directories or bookmark sites. "Low-quality directory or bookmark site links" is a named example.
10. Don't swap links or run partner pages built for cross-linking.
11. Don't put a footer badge or embeddable widget with a keyword-rich link on other sites. If you ever ship an embed, keep the link plain or nofollow.
12. Don't require a link in terms of use (for example for API or data use) without letting the site nofollow it.
13. Don't buy expired film-site domains to redirect or rebuild.
14. Don't let user lists or profiles become indexable without moderation. User-generated spam and thin pages would pull down the domain ("presumption that individual pages ... match the overall quality of other pages on the domain").
15. Don't disavow anything unless you get a manual action. Google says most sites don't need it, and the tool doesn't support Domain properties. Don't use anchor-text-optimized links in press releases or forum signatures.

## Measurement plan with free tools

Baseline now (week 0): record the indexed and not-indexed counts by reason (Page indexing), known URL total, crawl requests per day split by Discovery and Refresh (Crawl stats), Links report totals and a "Latest links" export, and Performance clicks and impressions by page for the last 28 days.

Weekly checklist (about 20 minutes):

| Tool | What to look at | Why |
| --- | --- | --- |
| Search Console Links report | Export "Latest links". Diff against last week: new linking domains, which target pages, anchor text. | Confirms Google has *found* the links you earned. Expect a lag (not documented). |
| Search Console Page indexing | Indexed count. "Discovered - currently not indexed" and "Crawled - currently not indexed" counts. Total known URLs. | The main outcome: fewer Discovered, more Indexed. |
| Search Console Crawl stats | Total requests per day, Discovery versus Refresh, host status, average response time. | Rising Discovery crawls after a link event is the documented signal. Host status green rules out the "overload" explanation. |
| URL Inspection | 5 to 10 sample title pages linked from new external links: "Discovered" or "Crawled", referring page, last crawl. | Shows per page whether the link led to a crawl. Not verified here: whether Inspection lists the external referring page. |
| Search Console Performance | Pages dimension. Compare the 28 days before and after each link event. Filter to the pages that got links. | Did linked pages gain impressions? |
| Bing Webmaster Tools | Backlinks (referring domains, anchors), Search performance, URL inspection. Import the site from Search Console. Turn on IndexNow for Bing and Yandex. | A second, free backlink view, often fuller than Google's sample. |
| PostHog | Referrers by domain (reddit.com, news.ycombinator.com, t.co, producthunt.com, github.com, and so on), landing pages, sign-ups by referrer. | Human traffic is the real value of nofollow links. Catches links days before Search Console shows them. |

Keep a simple log of each link event: date, URL, nofollow or not, and target page. That lets you line up Crawl stats and Page indexing changes against it, 1 to 4 weeks later. Judge it over months, not days.

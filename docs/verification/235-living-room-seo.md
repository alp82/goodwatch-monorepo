# Living room SEO (#235)

Verified on 2026-09-28, on `feat/235-living-room-seo`. Build-ready; not deployed by this task.

## Changes

- The home route has a movie/TV discovery title and description, consistent Open Graph and Twitter metadata, and one absolute canonical: `https://goodwatch.app/`. TV state, focus, and campaign parameters retain that canonical. English and x-default alternates use the same URL; no translated pages are implied.
- A linked Organization / WebSite / WebPage JSON-LD graph replaces the empty object. It describes GoodWatch, not personalized recommendations or third-party ratings.
- The existing server-rendered accessible navigation now explains Discover, Taste, Explorer, Search, Movies, TV shows, and How GoodWatch works. Its content is available without JavaScript and becomes visible on keyboard focus, with scrolling when needed on small screens. The room, TV screens, H1s, Remote, transitions, and loaders are unchanged. This is a navigation alternative for people, not crawler-only copy.
- The static sitemap includes Explorer. The main sitemap index points directly to the movie and show URL sets, rather than nesting other indexes. Legacy detail indexes remain available for existing Search Console submissions. The generator matches the checked-in XML.
- Search remains outside the sitemap because it is noindex. Taste can redirect guests to the quiz; auth, quiz, legacy `/living-room`, and parameterized TV views remain excluded.

The sitemap fix follows [Google's nested-index error guidance](https://support.google.com/webmasters/answer/7451001?hl=en#zippy=%2Cincorrect-sitemap-index-format-nested-sitemap-indexes). The graph follows [Google's WebSite guidance](https://developers.google.com/search/docs/appearance/site-names), and navigation uses [crawlable anchors](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

## Verification

- Biome: both changed TSX files pass. Biome does not support the changed Python/XML files; Python parses and XML parsing confirms generator/static URL parity and valid URL-set children.
- `npm run typecheck`: 236 TypeScript diagnostics (the accepted existing ceiling), exit 2; no increase.
- `npm test`: 54 passed, 0 failed.
- `npm run build`: succeeds. Existing Sentry warning: no token for source-map upload.
- Production build served temporarily on localhost:3235. The documented dev server at localhost:3003 was unavailable. Chrome DevTools MCP was unavailable, so browser checks used installed Playwright/Chromium.
- Guest `/` returns 200 with `public, max-age=0, s-maxage=1800, stale-while-revalidate=7200`. Browser, Googlebot, and iPhone user agents receive byte-identical HTML. No User-Agent Vary was introduced.
- Source contains both responsive H1 editions as before; CSS selects one before hydration. Hydrated desktop (1440x900) and phone (390x844) each expose their original H1. One canonical, index/follow, valid JSON-LD, and seven navigation anchors are present. TV-state/campaign URLs keep the root canonical, including without JavaScript.
- Desktop and phone render without page errors. Navigation becomes visible on focus and fits the phone viewport. The TV About screen, browser Back, navigation to How GoodWatch works, and return to the room were checked.
- `/living-room?tv=moods` still returns 301 to `/?tv=moods`.
- The sitemap index reaches 9 static pages, 87 category pages, 700 movies, and 300 shows. Current production returns 200 at `/discover`, `/movies`, `/shows`, `/explorer`, and `/how-it-works`.
- Lighthouse against the local production build, default mobile simulation: SEO **100**, performance **59**, LCP **8.2 s**, FCP **6.3 s**, TBT **140 ms**, CLS **0**. This does not meet the #233 LCP budget; that issue recorded 7.8 s LCP / 6.3 s FCP before this work. Local timings are not production field measurements.

## After deployment

Search Console access was not available in this session. The earlier finding that only the homepage was indexed is user-provided context, not a newly measured result. No indexing improvement is claimed yet.

1. Purge or let cached guest HTML expire. Inspect `/` source through the CDN for the metadata, graph, H1, and anchors above. Verify guest cache hits and member `private, no-store`; check a TV-state URL has the root canonical and the legacy route still redirects.
2. Keep `REC_EXPLORER=on` for public Explorer access (already HTTP 200 in production during this check). It is 404 in local environments where the feature is off; do not advertise a disabled route in a deployed sitemap.
3. Resubmit `https://goodwatch.app/sitemaps/sitemap.xml` in Search Console. Confirm all four direct children are fetched successfully and the nested-index error is absent. Monitor discovered URLs against the counts above; preserve the previously submitted legacy detail indexes.
4. Run URL Inspection live tests for `/`, `/discover`, `/movies`, `/shows`, `/explorer`, one category, and one movie/show URL from the sitemap. Check rendered HTML, allowed indexing, fetch status, and user-declared canonical. After recrawling, compare Google's selected canonical. Request indexing for the homepage and representative discovery pages.
5. Record dated Page indexing and Performance exports, then compare after recrawling: unknown/discovered/crawled/indexed URLs, exclusion reasons, impressions, and clicks. Sitemap inclusion and SEO score do not guarantee indexing. If pages remain unknown, investigate sitemap fetches and referring links; if crawled but unindexed, inspect the affected page's actual content and canonical.
6. Validate deployed JSON-LD with Schema.org's validator. WebSite/WebPage markup need not produce a rich-result card. Check the social image at `/og/index.png`.
7. Repeat mobile Lighthouse against CDN-served HTML and track field LCP p75, INP, and the #233 idle CPU checks. The existing performance budget miss remains a rollout decision.

# SEO audit, October 2026

Audit date: October 29, 2026. Parent map: [#784, Instant page loads everywhere](https://github.com/alp82/goodwatch-monorepo/issues/784). Source baseline: `0f4a8c78b`, from `origin/main`. Changes are on `perf/seo`; they have not been pushed or deployed.

## Findings

The sample has complete server-rendered content, consistent canonical addresses, readable internal links, and working host redirects. Search Console still shows a substantial discovery and indexing gap. The home page is indexed; Discover is crawled but not indexed; the other 13 inspected addresses are unknown to Google. These observations do not establish a sitewide technical cause.

This branch fixes two confirmed defects:

1. **Restricted profile tabs inherited public indexing eligibility.** A profile with public scores could advertise a members-only Wishlist or private Stats tab as `index, follow`. `5dd71db93` checks the tab's guest visibility before allowing indexing. Tropes requires both public taste and public scores. The public overview retains the existing consent and score threshold. Tests cover eight required-part cases across two restricted audiences and three viewer types, plus public and ineligible profiles.
2. **Empty category pagination returned indexable HTTP 200.** `/movies/moods/scary?page=999999` returned an empty list, self canonical, and `index, follow` in production. `fca3165ee` returns 404 for an empty later page after a healthy catalog read. Page one stays available. Failed reads do not establish a missing page. The isolated candidate returned 404 for the same path. This follows [Google's soft 404 guidance](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors).

Neither fix promises ranking or indexing gains. Larger language, content, and discovery decisions remain recommendations below.

## Scope and method

- Read the repository instructions, linked agent docs, root context, cache identity and page cache ADRs, serving and cache documentation, navigation benchmarks, SEO history, and [internal-links proposal](discovery-search/internal-links-proposal.md). Read #784 and its comments. The previous [technical audit](discovery-search/tweet-technical-seo.md) and [fix validation](discovery-search/technical-seo-fixes-validation.md) describe earlier snapshots; this audit does not repeat their wider link crawl.
- Made unauthenticated production GET requests sequentially, with a one-second pause after each request. No production browser session, database access, configuration change, submission, or deployment ran. Redirect following was sequential. The crawl used a desktop Googlebot user agent; it did not impersonate a verified Google IP address.
- Saved 83 responses, including six sitemap files, 29 primary successful pages, missing resources, redirects, query variants, and browser/language comparisons. Two additional GETs checked an explicit German localization cookie. Raw evidence and scripts are under `~/.cache/gw-perf/scratch-seo/` and are not committed.
- Compared nine page types using Googlebot without language, browser without language, browser with `de-DE`, and Googlebot with `de-DE`. Checked document head titles separately from SVG accessibility titles. Parsed JSON-LD, H1/H2 headings, anchors, image alt attributes, canonicals, robots and social metadata.
- Used `scripts/gsc.py` for read-only sitemap status, page and query analytics, and 15 sequential URL inspections. Analytics cover July 29 through October 28, 2026, with a 25,000-row limit. Inspection uses Google's stored index state, not a live test. These read-only Google API operations do not modify the site.
- Lighthouse uses saved production documents replayed on loopback. Browser interception blocks scripts, styles, images and all external requests; the local replay serves the captured HTML and robots.txt. This checks the SSR document's SEO audits without allowing analytics POSTs or an uncontrolled production request fan-out. It does not measure performance, hydration, resource accessibility, or Google's rendered page. See the results and limits below.
- Local application servers ran only through the HTML equivalence harness, with `env -i`, validated loopback endpoints, empty external keys, and the provided egress-blocking preload. The fixture stores are local. No production `.env` was loaded by a server.

## Page types and metadata

The following table describes production before these fixes. Sizes are uncompressed UTF-8 document bytes, rounded to decimal KB. `Index` means `index, follow`; `Noindex` preserves the page's existing directive. The `/new` request redirects to `/new/us`, and `/wishlist` redirects to `/watch-next`.

| Page type or address | Final status | Robots | Canonical | Title / description characters | HTML KB | Anchors |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| `/` | 200 | Index | Self | 45 / 148 | 219.0 | 108 |
| `/movie/603-the-matrix` | 200 | Index | Self | 58 / 235 | 387.2 | 149 |
| `/show/1396-breaking-bad` | 200 | Index | Self | 62 / 252 | 400.2 | 147 |
| `/person/6384-keanu-reeves` | 200 | Index | Self | 45 / 209 | 326.5 | 103 |
| `/discover` | 200 | Index | Self | 40 / 355 | 234.2 | 62 |
| `/movies/best` | 200 | Index | Self | 47 / 135 | 505.9 | 278 |
| `/shows/best?page=2` | 200 | Index | Self | 60 / 160 | 160.0 | 76 |
| `/movies` | 200 | Index | Self | 48 / 329 | 129.7 | 71 |
| `/shows/moods` | 200 | Index | Self | 58 / 172 | 1665.6 | 202 |
| `/movies/moods/scary` | 200 | Index | Self | 54 / 244 | 246.6 | 65 |
| `/people` | 200 | Index | Self | 58 / 90 | 134.9 | 198 |
| `/new` | 200 | Index | Self | 78 / 137 | 850.2 | 419 |
| `/new/us/netflix` | 200 | Index | Self | 60 / 135 | 496.3 | 287 |
| `/hot-on-socials` | 200 | Index | Self | 26 / 109 | 78.7 | 21 |
| `/blog` | 200 | noindex, follow | Self | 16 / 86 | 72.1 | 23 |
| `/blog/streaming-by-country-2026` | 200 | noindex, nofollow | Self | 56 / 171 | 180.9 | 43 |
| `/about` | 200 | Index | Self | 17 / 142 | 87.1 | 28 |
| `/how-it-works` | 200 | Index | Self | 31 / 157 | 93.8 | 39 |
| `/support` | 200 | Index | Self | 19 / 136 | 95.1 | 35 |
| `/privacy` | 200 | Index | Self | 19 / 99 | 99.5 | 23 |
| `/terms` | 200 | Index | Self | 28 / 98 | 74.5 | 25 |
| `/disclaimer` | 200 | Index | Self | 22 / 44 | 71.2 | 22 |
| `/use-with-ai` | 200 | Index | Self | 61 / 164 | 140.8 | 35 |
| `/discord` | 200 | Index | Self | 44 / 152 | 128.3 | 28 |
| `/sign-in` | 200 | noindex, follow | Self | 19 / 92 | 92.0 | 22 |
| `/sign-up` | 200 | noindex, follow | Self | 19 / 101 | 92.4 | 22 |
| `/my-shows` | 200 | noindex, follow | Absent | 20 / 107 | 72.5 | 21 |
| `/wishlist` | 200 | noindex, follow | Absent | 22 / 101 | 72.6 | 21 |
| `/settings` | 200 | noindex, nofollow | Self | 20 / 98 | 72.6 | 21 |

All 29 primary pages have unique, nonempty document titles and descriptions within this sample. Twenty-eight have one H1; the settings shell has none and is intentionally noindex. No captured HTML image lacks an alt attribute. Empty decorative alt text is valid. Indexable primary pages have one absolute canonical and the shared Open Graph and Twitter card fields. No sampled response sends `X-Robots-Tag`; robots meta carries the policy.

Descriptions range from 44 to 355 characters. Discover and the media hubs have lengthy, similar boilerplate, and the title/person descriptions are also long. Search snippets can truncate these. Length alone is not an invalid meta tag or a demonstrated indexing blocker. Recommend concise, specific copy as a separate editorial change rather than imposing arbitrary character cutoffs on names and summaries.

### Profiles and share lists

Successful profile and share-list rendering could not be sampled live: the known profile candidate and its list directory returned 404, and current sitemaps contain no profile or share-list addresses. No private member identifier or URL is included here. These surfaces therefore have source and unit-test evidence, not a verified successful production response or Lighthouse result.

- Profile overview: existing `shell.indexable` requires guest-visible scores, the minimum score count, and completed visibility consent. Eligible overviews emit `ProfilePage` with a `Person` main entity. Ineligible profiles use `noindex, nofollow`.
- Profile tabs: the fix requires the relevant part to be visible to everyone, independently of whether the current viewer is a guest, member, or owner. It retains the existing canonical and preview card.
- Share lists: the `/u/:handle/lists/:id` meta function emits an absolute canonical, `noindex, follow`, and versioned Open Graph/Twitter image metadata. Missing/deleted lists return 404. Loader and visibility policy tests pass. A valid list remains a live-verification gap.
- Private member surfaces: sampled My shows, Watch next and Settings are noindex and `private, no-store`. Sign-in and sign-up are noindex but crawlable, so crawlers can read their directive. Password forms also declare noindex in source. No change to robots.txt blocks those directives.
- Blog: the index is intentionally noindex while no post is published. The sampled study is a draft and uses `noindex, nofollow`; its public preview is not an accidental indexing exclusion.

## Redirects, duplicates and empty pages

| Input | First response | Destination or result |
| --- | ---: | --- |
| HTTP non-www `/movies` | 301 | HTTPS non-www `/movies` |
| HTTP www `/movies` | 301 | HTTPS non-www `/movies` |
| HTTPS www `/movies` | 301 | HTTPS non-www `/movies` |
| `/movies/` | 200 | Canonical `/movies`; slash variant consolidates by canonical |
| `/MOVIES` | 404 | Unknown hub capitalization does not produce a duplicate indexable page |
| `/movie/603-THE-MATRIX` | 301 | `/movie/603-the-matrix` |
| `/movie/603` | 301 | `/movie/603-the-matrix` |
| `/tv/1396` | 301 | `/show/1396`, then canonical title slug |
| `/tv-shows` | 301 | `/shows` |
| `/discover/all?withCast=6384` | 301 | `/person/6384-keanu-reeves` |
| `/sitemap.xml` | 301 | `/sitemaps/sitemap.xml` |

Invented title, profile, list and route addresses returned 404 with private, non-stored responses. An invalid `/new` service returned 404. The confirmed empty-category exception is fixed on this branch. No claim is made that every catalog record or possible filter combination was checked.

`?country=DE` on a title keeps the base canonical. Discover country/filter variants canonicalize to `/discover`; search mode carries noindex. The robots file blocks `/discover?`, `/discover/*?` and `/person/*?`. This bounds crawling, but also means Google normally cannot fetch those query pages to read their canonical or noindex tags. Keep that tradeoff explicit. A broader decision to let Google crawl query variants needs a bounded parameter policy and crawl measurements first.

Best-list pagination preserves `?page=N` in the canonical and exposes previous/next anchors. Category pagination does the same. Page-one aliases consolidate to the base address. Metadata across category pages is not page-number-specific; a future copy pass can distinguish later pages. The new empty-page 404 prevents arbitrarily deep, empty category pages from being presented as successful results.

## Language and crawler equivalence

Every sampled response uses an English UI and `<html lang="en">`, with no hreflang alternates. On The Matrix, a German browser preference changes the displayed/media metadata name to “Matrix”; Googlebot continues to receive “The Matrix” and canonical English media. The browser and crawler keep the same canonical address. The explicit German localization-cookie probe produced the same split: browser “Matrix”, Googlebot “The Matrix”, both HTTP 200. It is recorded in the local evidence.

The nine paired comparisons retain the primary heading, canonical and robots policy. Byte sizes differ because browser loader data, locale-dependent title fields, streaming offers, and crawler-specific serialized payloads differ. Equal bytes are not required for an equivalent first load. This audit checked content presence rather than asserting byte-for-byte browser/Googlebot identity.

This is coherent for the English URL but does not make every translated catalog variant independently discoverable. [Google documents](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages) that its default crawler sends no Accept-Language and may miss adaptive variants. [Separate language URLs with reciprocal hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions) are the documented approach for indexing alternatives. Adding many language codes that all point to the same adaptive URL would not create distinct language versions.

**Owner decision:** keep one English search identity with localized browsing, or plan stable language URLs, canonical rules, translation coverage, internal links, sitemap coverage and cache identity together. Do not add automatic language redirects or change the current locale/cache contract in this ticket.

## Structured data

Parsed all captured JSON-LD successfully. A local validator loaded the current [schema.org JSON-LD vocabulary](https://schema.org/version/latest/schemaorg-current-https.jsonld), followed class inheritance, and checked property domains on 2,372 typed nodes across captured responses, including repeated samples. It found zero property-domain mismatches. This is a syntax and vocabulary-domain check, not a full range, content-policy, or Google Rich Results Test certification.

| Surface | Observed or source type | Checks and rich-result limits |
| --- | --- | --- |
| Start | Organization, WebSite, WebPage | Stable IDs, site URL, organization name and logo; English language |
| Movie | Movie, BreadcrumbList; nested WatchAction | Name and poster image are present; directors, release date, duration and canonical URL are populated. Watch actions reflect offers for the displayed country. |
| Show | TVSeries, BreadcrumbList; nested WatchAction | Name, image, season/episode counts and applicable dates; no fabricated aggregate rating |
| Person | Person | Name, canonical URL, image and TMDB identity; a person filmography alone does not imply a Google rich-result feature |
| Best lists, People, New | ItemList; breadcrumbs where applicable | Positions and destination URLs; later best-list ranks continue from 251 |
| Category hubs and leaves | BreadcrumbList | Ordered positions, names and absolute item URLs |
| Blog study | BlogPosting, Dataset, BreadcrumbList | Headline, dates, author/publisher, image; dataset name, description, license and downloads; draft noindex intentionally prevents eligibility |
| Profile overview | ProfilePage, Person, from source | Main entity has a name and URL; emitted only for an eligible public overview |
| Discover, Hot, static pages, forms, share lists | No required rich-result type | Missing optional structured data is not a validation failure |

[Google's movie carousel requirements](https://developers.google.com/search/docs/appearance/structured-data/movie) require name and image, with list/carousel conditions as well. Valid detail markup does not guarantee a carousel. Existing `ItemList` summary links are consistent with linking to detail pages. [Breadcrumb requirements](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) are met by the sampled trails. [ProfilePage requirements](https://developers.google.com/search/docs/appearance/structured-data/profile-page) concern a creator's profile; the code supplies a main entity rather than applying the type to actor filmographies. Imported aggregate ratings remain omitted, consistent with the existing policy. Media Actions enrollment and actual rich-result appearance were not tested.

## Robots and sitemaps

The live robots.txt is HTTP 200, names the sitemap index, and allows primary public paths. It blocks APIs, browser checks, streaming clickouts, and the query patterns described above. It does not block scripts or styles by directory. No sampled indexable primary path is disallowed.

The six live child sitemaps contain **1,432 URLs** in total, with no duplicate locations across the files. They list 700 movies, 300 shows, 30 people, 87 categories, 300 New pages, and 15 static pages. Profiles, share lists, forms and the draft blog are absent as intended. Terms is indexable but not listed; sitemap omission alone is not a crawl block, and adding every legal page is unnecessary.

| Child sitemap | Live URLs | URL lastmod | Search Console submitted | Last downloaded, UTC |
| --- | ---: | --- | ---: | --- |
| `static` | 15 | Omitted | 11 | 2026-10-18T10:20:53.792Z |
| `categories` | 87 | Omitted | 87 | 2026-10-18T10:21:01.527Z |
| `movie_detail_0` | 700 | Omitted | 700 | 2026-10-18T10:21:07.012Z |
| `show_detail_0` | 300 | Omitted | 300 | 2026-10-18T10:21:13.228Z |
| `people` | 30 | Omitted | 30 | 2026-10-23T17:45:03.767Z |
| `new` | 300 | 2026-10-25 on all entries | 300 | 2026-10-28T03:35:50.461Z |

All seven sitemap records, including the index, report zero errors and zero warnings. The static sitemap's live 15 versus reported 11 reflects the API's older submitted inventory, not a current XML error. The API reports indexed counts of zero even though URL Inspection confirms the home page is indexed; use inspection or the Search Console UI for indexing conclusions.

Title, person, category and static URL entries omit lastmod. Omitting an unknown modification date is valid. Do not replace it with the current date on every build: [Google asks for a significant content-change date](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). The New sitemap's lastmod is October 25; validating it against live underlying content would require data/change-history access outside this audit. The sitemap index also carries generation-era dates for most child files.

## Search Console evidence

### Last three months

Page-dimension analytics returned six rows: **93 clicks and 2,578 page impressions**. The home page has 93 clicks and 2,549 impressions, average position 8.15. Discover, Movies, Shows and Taste each have zero clicks and seven impressions; the www home has one impression. Page impressions are a page-dimension sum, not a property-level unique impression total.

Query-dimension analytics returned 41 rows. The leading click-bearing queries are `goodwatch app` (43 clicks, 860 impressions), `goodwatch` (22, 849), `good watch app` (2, 112), `goodwatch streaming` (2, 24), and `goodwatch tv` (2, 107). Query totals differ from page totals because query reporting omits some traffic. No movie or person page appears in these page rows. This supports prioritizing measured discovery/indexing work; it does not prove that metadata caused the gap.

### URL inspection

Fifteen inspections completed, below the 40-URL cap:

| URL or type | Stored state |
| --- | --- |
| `/` | PASS, submitted and indexed; Google canonical is `/`; last crawl October 26, 23:57 UTC |
| `/discover` | Crawled, currently not indexed; Google canonical is `/discover`; last crawl October 11, 04:30 UTC; robots allowed |
| Matrix movie, Breaking Bad show, Keanu Reeves person | Unknown to Google |
| `/movies/best`, `/movies`, `/movies/moods/scary`, `/people` | Unknown to Google |
| `/new/us/netflix`, `/hot-on-socials`, `/blog`, `/about` | Unknown to Google |
| `/sign-in`, `/sign-up` | Unknown to Google; live documents correctly declare noindex |

Unknown is not a live crawl failure and is not proof of robots blocking. The three title/person samples can be unknown even when their URLs occur in a submitted sitemap. Reuse the existing [index record](discovery-search/index-record.md) for longitudinal tracking rather than starting another broad inspection sweep.

## Lighthouse SEO

Lighthouse 13.5.0 ran the SEO category in mobile mode on 33 saved production documents. All **22 indexable successful pages scored 100**: start, movie, show, person, Discover, best lists, hubs, category, People, New, Hot and all eight sampled static pages. The seven intentionally noindex successful pages scored 66 or 69, with only `is-crawlable` failing. The four 404 documents have no category score because navigation returned an error. No indexable document had a failing scored SEO audit.

| Group | Pages | SEO outcome |
| --- | ---: | --- |
| Indexable public pages | 22 | 100 on every page |
| Empty blog and draft study | 2 | 69; intentional noindex |
| Sign-in and sign-up | 2 | 69; intentional noindex |
| My shows and Watch next | 2 | 66; intentional noindex |
| Settings | 1 | 69; intentional noindex |
| Missing title, profile, list and route | 4 | Unscored HTTP 404 |

The replay audits the captured first-load HTML, not a live hydrated application. It serves robots.txt locally and blocks all other resources. External image fetching, CSS rendering, hydration, actual host/network behavior, and manual structured-data audits are outside its scope. These scores must not be presented as full production Lighthouse scores. The benchmark ticket owns full mobile/desktop resource and performance measurements.

## Verification and intended HTML changes

- `npx tsc --noEmit`: 189 diagnostics on this branch and 189 on a clean `origin/main` archive with the same installed dependencies. After normalizing source line/column locations, outputs match exactly. Existing failures include category parameter indexing and unavailable authentication conformance test packages. No new diagnostic appears in the changed metadata, tests, path helper, or pagination helper.
- Targeted Node tests: **52 passed**, covering metadata, canonical/title redirects, blog structured data, watch actions, profile visibility, and pagination health. Additional share-list, blog publication and profile policy tests: **54 passed**. This repository uses `node --test` for these tests. It has no installed Vitest runner or relevant SEO Vitest suite; the unrelated authentication conformance Vitest config is among the baseline TypeScript failures.
- `goodwatch-benchmark/html-equivalence/run.sh local origin/main perf/seo`: final run compared **342 documents per gate**, three gates, **zero differences** each. It covers 114 paths under Googlebot, Bingbot and browser identities, including 30 movies, 72 shows and static/category paths. There are zero person rows in the local fixture store; list and some category data are empty on both sides. These fixture limitations do not prove successful live profile/person/list equivalence.
- The harness's scratch directory and dependency source were temporarily redirected into this ticket's scratch directory and own dependencies; its starting port moved to avoid another local benchmark. Those local path changes were restored and are not committed. An initial harness attempt failed because its Valkey port collided with another local run; the final isolated run completed and cleaned up its own servers, containers and temporary worktrees.
- The isolated candidate answered 404 for `/movies/moods/scary?page=999999`; production answered 200. Unit tests verify a healthy empty later page, a populated later page, empty page one, a flagged result, and a failed request context.
- Intended document changes outside the gate's fixture coverage: restricted profile tabs change their one robots tag from `index, follow` to `noindex, nofollow`; healthy empty later category pages change from the category document at HTTP 200 to the existing error document at HTTP 404. Public populated first loads retain their headings, content, links, metadata and structured data. Moving profile path/type exports preserves their public import API.
- No scripts, styles, fonts, images, app shell or poster card changed on a landing surface. No performance-budget adjustment is included. The SEO replay produces no performance or Lighthouse accessibility claim.

## Owner decisions and remaining verification

1. Choose the language URL strategy described above. Coordinate any new variants with the existing country/language cache identity; do not place member responses in a shared cache.
2. Continue the existing bounded indexing cohort and weekly record. Review Search Console's Page Indexing and Crawl Stats UI for exclusion examples, server errors and trends; the client cannot expose every UI report. Do not expand the sitemap simply to compensate for unknown URLs.
3. Review the existing internal-links proposal and the already shipped best lists/People page before approving more content. This audit confirms SSR anchors in every sampled indexable page, but does not repeat a whole-site reachability or broken-link crawl.
4. Review concise Discover/hub descriptions and page-specific pagination copy. The largest sampled crawler document is `/shows/moods`, **1,665,584 bytes**, below [Googlebot's current 2 MB uncompressed limit](https://developers.google.com/search/docs/crawling-indexing/googlebot), but with limited growth margin. Reduce duplicate serialization or incidental markup only while retaining the complete first load.
5. Provide a public profile and share-list specimen for follow-up GET-only verification, or verify them in an isolated fixture. A successful live private/member page was not requested with credentials, and no private data was accessed.
6. After the owner deploys, verify the two intended changes on public examples and rerun full resource-enabled Lighthouse through the safe benchmark workflow. Google Rich Results Test, live URL inspection rendering, translated-language coverage beyond German, authenticated metadata, sitemap content-change dates, and real ranking effects remain unverified.

# HTML weight

Measured on October 29, 2026 for [#784](https://github.com/alp82/goodwatch-monorepo/issues/784), from `origin/main` at `0f4a8c78b`. Candidate branch: `perf/html`.

## Findings

The largest category documents serialize 40 discovery records for every row even though `MovieTvList` renders only eight and offers no row expansion. `/shows/moods` sends 800 title records for 160 cards. Keep the first eight records in each route payload and omit section metadata that the component never reads. The shared discovery result cache retains all 40 records. Both changes run before localization, so only the displayed cards need the language overlay.

On the captured production document, these changes reduce `/shows/moods` from **1,665,584 to 740,444 uncompressed bytes (55.5%)**, and `/movies/moods` from **1,760,222 to 752,973 bytes (57.2%)**. These are exact serialization projections on saved responses, not a deployed measurement. Isolated builds verify the implementation separately below.

The best-of lists and title pages have a different cause: most bytes are rendered markup. Removing loader fields there cannot deliver the same gains. Preserve the complete first load, all cards, structured data, and crawlable links. No deferred document data, hydration fallback, or hydration-enabled client loader was added.

Google documents a [2 MB limit on uncompressed Googlebot resources](https://developers.google.com/search/docs/crawling-indexing/googlebot). The captured movie mood hub leaves only about 240 KB below a decimal 2 MB threshold before this change. Compression does not increase that parsing budget.

## Measurement method

The capture made 93 serial, anonymous GET requests to explicit public paths, with a Googlebot user agent, no cookies or Accept-Language, and `Accept-Encoding: gzip`. It waited at least 1.1 seconds between requests. Redirects were recorded without following them. There were no production writes, configuration changes, deploys, or load tests.

All sizes below are bytes. Wire gzip is the actual encoded response body, excluding headers. Gzip 9 and Brotli 11 in the JSON artifacts are local recompressions of the same decoded HTML. They are comparable estimates, not claims about the serving proxy’s compression settings. This run observed larger gzip transfers than the ticket’s earlier 30–61 KB compressed samples, particularly on the hubs; do not compare different encodings or captures as if they were a controlled before/after.

Markup means everything outside script elements, including style elements. Loader script includes the complete script containing `window.__remixContext`; route loader sizes are independently serialized JSON without the surrounding Remix state and HTML escaping. SVG, class attributes, inline styles, hidden related links and JSON-LD are overlapping categories, not additive partitions. Aggregated JSON key totals overlap their parent objects. Duplicate title bytes count only byte-identical serialized objects, not merely titles with matching IDs.

The [baseline JSON](../../goodwatch-benchmark/html-weight/baseline-2026-10-29.json) includes every response status, per-loader byte counts, each loader’s eight largest keys, aggregate key counts, repeated string counts and duplicate title bytes. The [route inventory](../../goodwatch-benchmark/html-weight/route-inventory.json) enumerates all 101 route modules outside `prototype`, `dev` and `api`, including redirects and resource routes.

## Document sizes

These are anonymous responses. A 200 on a member surface measures its guest shell, not the member’s library or settings. Missing profiles and invalid list IDs measure error responses only.

| Path | Status | Raw | Wire gzip | Markup | Loader script |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 200 | 219,002 | 36,544 | 195,521 | 16,880 |
| `/movies` | 200 | 129,686 | 21,439 | 127,089 | 909 |
| `/shows` | 200 | 124,878 | 21,232 | 122,282 | 908 |
| `/movies/moods` | 200 | 1,760,222 | 228,786 | 513,714 | 1,244,497 |
| `/shows/moods` | 200 | 1,665,584 | 201,216 | 510,978 | 1,152,598 |
| `/movies/genres` | 200 | 1,653,999 | 213,489 | 490,166 | 1,161,820 |
| `/shows/streaming` | 200 | 312,889 | 47,276 | 135,919 | 174,954 |
| `/movies/moods/feel-good` | 200 | 246,640 | 35,066 | 181,390 | 63,134 |
| `/shows/moods/scary/2` | 404 | 69,090 | 14,912 | 67,282 | 497 |
| `/movies/best` | 200 | 505,892 | 57,177 | 414,917 | 65,364 |
| `/shows/best` | 200 | 501,393 | 54,317 | 412,634 | 64,202 |
| `/movie/603-the-matrix` | 200 | 387,173 | 70,050 | 334,156 | 30,288 |
| `/show/1396-breaking-bad` | 200 | 400,166 | 73,084 | 356,524 | 29,707 |
| `/person/287-brad-pitt` | 200 | 335,070 | 43,901 | 295,711 | 37,352 |
| `/people` | 200 | 134,865 | 27,242 | 111,972 | 18,352 |
| `/discover` | 200 | 234,238 | 34,102 | 197,044 | 35,498 |
| `/discover/movie` | 301 | 0 | 0 | 0 | 0 |
| `/search` | 301 | 0 | 0 | 0 | 0 |
| `/explorer` | 200 | 470,876 | 94,974 | 199,914 | 269,282 |
| `/explore/movie/genres/drama` | 404 | 9 | 29 | 9 | 0 |
| `/for-you` | 200 | 77,519 | 16,911 | 74,938 | 903 |
| `/hot-on-socials` | 200 | 78,716 | 18,607 | 68,589 | 8,435 |
| `/new` | 302 | 0 | 0 | 0 | 0 |
| `/new/us` | 200 | 850,248 | 75,296 | 756,213 | 90,907 |
| `/new/us/netflix` | 200 | 496,303 | 51,246 | 441,480 | 51,643 |
| `/taste` | 200 | 74,170 | 16,053 | 71,561 | 921 |
| `/taste/quiz` | 200 | 337,519 | 106,223 | 71,435 | 264,400 |
| `/taste/fingerprint` | 301 | 0 | 0 | 0 | 0 |
| `/taste/everyone` | 301 | 0 | 0 | 0 | 0 |
| `/watch-next` | 200 | 72,578 | 15,703 | 69,980 | 914 |
| `/wishlist` | 301 | 0 | 0 | 0 | 0 |
| `/my-movies` | 200 | 75,546 | 16,170 | 72,929 | 935 |
| `/my-shows` | 200 | 72,548 | 15,875 | 69,918 | 950 |
| `/my-library` | 200 | 71,271 | 15,578 | 68,672 | 901 |
| `/my-library/scores` | 200 | 72,596 | 15,795 | 69,997 | 901 |
| `/my-library/hidden` | 200 | 71,574 | 15,667 | 68,961 | 915 |
| `/my-library/seen` | 200 | 72,491 | 15,814 | 69,836 | 959 |
| `/settings` | 200 | 72,596 | 15,921 | 69,839 | 954 |
| `/settings/account` | 302 | 0 | 0 | 0 | 0 |
| `/settings/profile` | 200 | 72,475 | 15,866 | 69,707 | 963 |
| `/settings/services` | 200 | 70,860 | 15,548 | 68,129 | 924 |
| `/settings/imports` | 200 | 72,108 | 15,883 | 69,351 | 952 |
| `/settings/language` | 200 | 70,766 | 15,528 | 68,035 | 924 |
| `/settings/connected-apps` | 200 | 71,111 | 15,625 | 68,333 | 959 |
| `/settings/discover-privacy` | 200 | 70,805 | 15,545 | 68,050 | 932 |
| `/sign-in` | 200 | 92,002 | 22,216 | 78,000 | 12,324 |
| `/sign-up` | 200 | 92,449 | 22,317 | 78,465 | 12,306 |
| `/forgot-password` | 200 | 89,883 | 21,575 | 75,892 | 12,297 |
| `/reset-password` | 200 | 90,083 | 21,643 | 76,095 | 12,296 |
| `/verify-email` | 200 | 77,361 | 16,297 | 74,760 | 913 |
| `/auth/mcp/consent` | 400 | 73,287 | 15,724 | 70,853 | 998 |
| `/discord` | 200 | 128,270 | 25,310 | 125,680 | 898 |
| `/discord/link` | 302 | 0 | 0 | 0 | 0 |
| `/about` | 200 | 87,067 | 19,412 | 84,504 | 889 |
| `/how-it-works` | 200 | 93,806 | 19,056 | 91,222 | 896 |
| `/use-with-ai` | 200 | 140,775 | 28,150 | 138,194 | 895 |
| `/support` | 200 | 95,117 | 20,454 | 92,548 | 891 |
| `/terms` | 200 | 74,499 | 16,810 | 71,936 | 889 |
| `/privacy` | 200 | 99,522 | 26,378 | 96,941 | 903 |
| `/disclaimer` | 200 | 71,185 | 15,580 | 68,607 | 894 |
| `/browser-check` | 410 | 4 | 4 | 4 | 0 |
| `/blog` | 200 | 72,128 | 15,729 | 69,226 | 930 |
| `/living-room` | 301 | 0 | 0 | 0 | 0 |
| `/tv/1396-breaking-bad` | 301 | 0 | 0 | 0 | 0 |
| `/tv-shows` | 301 | 0 | 0 | 0 | 0 |
| `/tv-shows/moods` | 301 | 0 | 0 | 0 | 0 |
| `/tv-shows/moods/scary` | 301 | 0 | 0 | 0 | 0 |
| `/lists/new` | 200 | 225,976 | 47,322 | 124,785 | 99,509 |
| `/lists/mine` | 302 | 0 | 0 | 0 | 0 |
| `/u/alp82` | 404 | 73,799 | 15,793 | 71,393 | 970 |
| `/u/alp82/scores` | 404 | 73,535 | 15,744 | 71,129 | 970 |
| `/u/alp82/seen` | 404 | 73,529 | 15,746 | 71,127 | 970 |
| `/u/alp82/shows` | 404 | 73,440 | 15,733 | 71,036 | 970 |
| `/u/alp82/wishlist` | 404 | 73,635 | 15,763 | 71,225 | 970 |
| `/u/alp82/lists` | 404 | 73,741 | 15,790 | 71,323 | 970 |
| `/u/alp82/taste` | 301 | 0 | 0 | 0 | 0 |
| `/u/alp82/stats` | 404 | 74,002 | 15,824 | 71,582 | 970 |
| `/u/alp82/tropes` | 404 | 73,809 | 15,804 | 71,403 | 970 |
| `/__html-weight-not-found__` | 404 | 72,139 | 15,496 | 69,741 | 970 |
| `/movies/moods/feel-good?page=2` | 200 | 246,536 | 35,239 | 180,774 | 63,646 |
| `/shows/moods/scary` | 200 | 240,430 | 33,785 | 180,102 | 58,224 |
| `/new/us/all` | 404 | 72,537 | 15,566 | 70,121 | 970 |
| `/blog/streaming-by-country-2026` | 200 | 180,897 | 34,203 | 170,797 | 4,747 |
| `/u/alp82/stats/genres` | 404 | 74,002 | 15,824 | 71,582 | 970 |
| `/lists/html-weight-missing` | 404 | 71,774 | 15,433 | 69,382 | 970 |
| `/u/alp82/lists/html-weight-missing` | 404 | 72,365 | 15,550 | 69,953 | 970 |
| `/u/alp82/lists/html-weight-missing/edit` | 404 | 72,399 | 15,569 | 69,973 | 970 |
| `/pmwiki/example` | 404 | 72,542 | 15,573 | 70,124 | 970 |
| `/tv-shows/moods/scary/2` | 301 | 0 | 0 | 0 | 0 |
| `/settings/country` | 200 | 70,761 | 15,528 | 68,033 | 923 |
| `/settings/streaming` | 301 | 0 | 0 | 0 | 0 |
| `/settings/where-you-watch` | 301 | 0 | 0 | 0 | 0 |
| `/settings/hidden` | 301 | 0 | 0 | 0 | 0 |

## Markup breakdown

Representative documents show where a further reduction would have to act. Class bytes include attribute syntax; styles include style attributes and style elements. The `pl-more` paragraph contains the related map’s hidden “Open a page” link copies.

| Path | SVG | Classes | Styles | Hidden related links | JSON-LD | Duplicate title JSON |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 50,794 | 72,686 | 4,209 | 0 | 1,049 | 0 |
| `/movies/moods` | 50,116 | 252,760 | 2,982 | 0 | 303 | 463,994 |
| `/shows/moods` | 49,291 | 252,760 | 2,982 | 0 | 300 | 322,004 |
| `/movies/best` | 41,516 | 219,242 | 2,982 | 0 | 23,927 | 0 |
| `/shows/best` | 40,691 | 219,016 | 2,982 | 0 | 22,873 | 0 |
| `/movie/603-the-matrix` | 58,944 | 120,122 | 50,406 | 6,659 | 16,257 | 0 |
| `/show/1396-breaking-bad` | 57,791 | 125,860 | 60,350 | 5,568 | 7,469 | 0 |
| `/person/287-brad-pitt` | 53,716 | 135,547 | 3,882 | 0 | 309 | 1,435 |
| `/discover` | 48,120 | 81,644 | 4,406 | 0 | 0 | 0 |
| `/explorer` | 42,484 | 36,055 | 4,884 | 0 | 0 | 0 |
| `/new/us` | 41,531 | 399,542 | 3,602 | 0 | 1,444 | 1,574 |
| `/taste/quiz` | 40,894 | 16,861 | 2,982 | 0 | 0 | 0 |

## Loader breakdown

The root loader is about 528 bytes on these anonymous captures, so cross-route duplication with root is negligible. Members can also carry their user query data in root; that path was not measured.

| Path | Route loader | JSON bytes | Largest fields (value bytes) |
| --- | --- | ---: | --- |
| `/` | `routes/_index` | 15,974 | `browse` 13,025, `titles` 2,913, `member` 5 |
| `/movies` | `routes/$type._index` | 17 | `type` 8 |
| `/shows` | `routes/$type._index` | 16 | `type` 7 |
| `/movies/moods` | `routes/$type.$category._index` | 1,243,020 | `pageResults` 1,242,946, `path` 15, `type` 8, `category` 7 |
| `/shows/moods` | `routes/$type.$category._index` | 1,151,116 | `pageResults` 1,151,044, `path` 14, `type` 7, `category` 7 |
| `/movies/genres` | `routes/$type.$category._index` | 1,160,858 | `pageResults` 1,160,782, `path` 16, `type` 8, `category` 8 |
| `/shows/streaming` | `routes/$type.$category._index` | 174,037 | `pageResults` 173,957, `path` 18, `category` 11, `type` 7 |
| `/movies/moods/feel-good` | `routes/$type.$category.$page` | 62,193 | `results` 60,347, `pageData` 1,134, `discoverParams` 583, `path` 25 |
| `/movies/best` | `routes/$type.best` | 64,469 | `titles` 64,372, `kind` 8, `services` 4, `total` 3 |
| `/shows/best` | `routes/$type.best` | 62,757 | `titles` 62,661, `kind` 7, `services` 4, `total` 3 |
| `/movie/603-the-matrix` | `routes/movie.$movieKey` | 29,263 | `media` 25,868, `dehydratedState` 1,492, `genreRow` 1,463, `newPages` 142 |
| `/show/1396-breaking-bad` | `routes/show.$showKey` | 28,754 | `media` 18,626, `episodeGrid` 7,868, `genreRow` 1,365, `dehydratedState` 424 |
| `/person/287-brad-pitt` | `routes/person.$personKey` | 36,445 | `groups` 26,619, `profile` 7,401, `knownFor` 1,440, `facets` 773 |
| `/people` | `routes/people` | 17,466 | `people` 17,455 |
| `/discover` | `routes/discover.($type)` | 34,552 | `browse` 34,541 |
| `/explorer` | `routes/explorer` | 268,159 | `world` 268,126, `displayLanguage` 4 |
| `/for-you` | `routes/for-you` | 16 | `kind` 7 |
| `/hot-on-socials` | `routes/hot-on-socials` | 7,541 | `row` 7,533 |
| `/new/us` | `routes/new.$where` | 90,007 | `days` 69,402, `offerServices` 7,914, `otherCountries` 6,742, `ranked` 3,036 |
| `/new/us/netflix` | `routes/new.$country.$service` | 50,732 | `days` 33,226, `otherCountries` 7,402, `offerServices` 5,054, `ranked` 2,949 |
| `/taste` | `routes/taste._index` | 29 | `kind` 8, `view` 4 |
| `/taste/quiz` | `routes/taste.quiz` | 262,335 | `smartTitles` 262,252, `dehydratedState` 29, `isLoggedIn` 5 |
| `/watch-next` | `routes/watch-next` | 24 | `data` 4, `query` 2 |
| `/my-movies` | `routes/my-movies` | 46 | `query` 12, `data` 4, `landed` 2 |
| `/my-shows` | `routes/my-shows` | 62 | `data` 4, `arrival` 4, `landed` 2, `services` 2 |
| `/my-library` | `routes/my-library._index` | 4 |  |
| `/my-library/scores` | `routes/my-library.scores` | 4 |  |
| `/my-library/hidden` | `routes/my-library.hidden` | 18 | `signedIn` 5 |
| `/my-library/seen` | `routes/my-library.$list` | 63 | `now` 13, `status` 6, `page` 4, `viewer` 4 |
| `/settings` | `routes/settings` | 4 |  |
| `/settings` | `routes/settings._index` | 36 | `handle` 4, `connectedApps` 4 |
| `/settings/profile` | `routes/settings` | 4 |  |
| `/settings/profile` | `routes/settings.profile` | 44 | `signedIn` 5, `handle` 4, `edit` 4 |
| `/settings/services` | `routes/settings` | 4 |  |
| `/settings/services` | `routes/settings.services` | 4 |  |
| `/settings/imports` | `routes/settings` | 4 |  |
| `/settings/imports` | `routes/settings.imports` | 33 | `imports` 2, `sourceImports` 2 |
| `/settings/language` | `routes/settings` | 4 |  |
| `/settings/language` | `routes/settings.language` | 4 |  |
| `/settings/connected-apps` | `routes/settings` | 4 |  |
| `/settings/connected-apps` | `routes/settings.connected-apps` | 33 | `now` 13, `apps` 4 |
| `/settings/discover-privacy` | `routes/settings` | 4 |  |
| `/settings/discover-privacy` | `routes/settings.discover-privacy` | 4 |  |
| `/sign-in` | `routes/sign-in` | 11,437 | `posters` 11,370, `maintenance` 5, `connecting` 4, `redirectUri` 2 |
| `/sign-up` | `routes/sign-up` | 11,419 | `posters` 11,370, `maintenance` 5, `redirectUri` 2 |
| `/forgot-password` | `routes/forgot-password` | 11,402 | `posters` 11,370, `maintenance` 5 |
| `/reset-password` | `routes/reset-password` | 11,402 | `posters` 11,370, `maintenance` 5 |
| `/verify-email` | `routes/verify-email` | 21 | `maintenance` 5 |
| `/discord` | `routes/discord._index` | 4 |  |
| `/about` | `routes/about` | 4 |  |
| `/how-it-works` | `routes/how-it-works` | 4 |  |
| `/use-with-ai` | `routes/use-with-ai` | 4 |  |
| `/support` | `routes/support` | 4 |  |
| `/terms` | `routes/terms` | 4 |  |
| `/privacy` | `routes/privacy` | 16 | `updated` 4 |
| `/disclaimer` | `routes/disclaimer` | 4 |  |
| `/blog` | `routes/blog._index` | 39 | `robots` 17, `posts` 2 |
| `/lists/new` | `routes/lists.new` | 98,370 | `quickPicks` 98,161, `initial` 125, `date` 14, `byline` 6 |
| `/movies/moods/feel-good?page=2` | `routes/$type.$category.$page` | 62,700 | `results` 60,854, `pageData` 1,134, `discoverParams` 583, `path` 25 |
| `/shows/moods/scary` | `routes/$type.$category.$page` | 57,283 | `results` 55,533, `pageData` 1,148, `discoverParams` 483, `path` 20 |
| `/blog/streaming-by-country-2026` | `routes/blog.$slug` | 3,857 | `structuredData` 3,148, `post` 682 |
| `/settings/country` | `routes/settings` | 4 |  |
| `/settings/country` | `routes/settings.country` | 4 |  |

### Repetition and remaining costs

- Category hubs repeat the same full title objects across overlapping moods and genres. The baseline counts 322,004 duplicate object bytes on `/shows/moods` and 463,994 on `/movies/moods`. Streaming-service ID arrays, image paths, dates and rating field names also repeat. Trimming unused records removes most of the unnecessary repetitions without changing the client’s object contract. Titles that remain in two visible rows stay in both rows. A shared title dictionary would need a separate loader/client contract and localization review.
- `/movies/best` and `/shows/best` render 250 rows: markup contributes about 413–415 KB, class attributes about 219 KB, and loader scripts about 64–65 KB. Their 23–24 KB JSON-LD item lists supply crawler links and are retained. Fixed poster srcsets contain the responsive alternatives used by the image helper; removing candidates can change image selection.
- Movie and show documents spend about 334 KB and 357 KB on markup. Loader data is only about 30 KB. Movie availability links take 11,060 JSON bytes, including 10,202 bytes of stream URLs. Those URLs support outbound streaming links and cannot simply be discarded. Episode-grid data supplies the show’s complete first load.
- The person document spends about 296 KB on markup and 37 KB on its loader script. Its 1,435 exact duplicate title bytes are small beside 136 KB of class attributes. Known-for and credit rows have separate roles in the page.
- Explorer serializes about 268 KB of world data; `maps`, `islands`, and `titles` dominate. Taste quiz similarly embeds its initial interactive pool. Neither payload was moved behind an interaction because that needs separate state and first-load completeness validation.
- Inline SVG contributes about 40 KB even on many small pages, mostly the repeated shell icons. Class and SVG deduplication could reduce parsing, but replacing inline elements with stylesheet classes or SVG references needs visual, specificity, accessibility, and asset-budget verification. This ticket does not claim that compression alone removes their parse cost.
- The related map’s hidden links mirror its visible title set. Keep both in sync, as required by the [internal-links proposal](../research/discovery-search/internal-links-proposal.md). Neither set changed.

## Separate reductions

`144b57474` trims only the serialized preview arrays. `896dddaf9` then retains only `path`, `label`, and `results` per section. It drops unused `type`, `subtitle`, `description`, `backdrop_path`, `discoverParams`, and `faq`. It also removes unused component-local variables. The title records that remain keep all their fields, including localization and interaction data.

| Captured path | Before raw | After previews | After metadata | Before Brotli 11 | After previews Brotli 11 | After metadata Brotli 11 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/movies/moods` | 1,760,222 | 783,698 | 752,973 | 102,990 | 41,410 | 36,441 |
| `/shows/moods` | 1,665,584 | 771,129 | 740,444 | 101,500 | 42,759 | 37,854 |
| `/movies/genres` | 1,653,999 | 734,977 | 710,731 | 97,588 | 40,293 | 35,139 |
| `/shows/streaming` | 312,889 | 175,416 | 172,988 | 32,275 | 19,603 | 19,320 |

The [projection artifact](../../goodwatch-benchmark/html-weight/projections-2026-10-29.json) also records Gzip 9 and loader-script bytes. Its final object key order supersedes the preliminary compression estimate in the metadata commit message: `/shows/moods` is 37,854 Brotli 11 bytes, 34 bytes smaller than that estimate; raw bytes are identical. Projection verifies that the captured Remix serialization matches exactly before changing it. It then edits only the identified context bytes. It does not estimate a render-time or Lighthouse gain.

## Validation

- `npx tsc --noEmit`: 189 diagnostics on untouched `origin/main`, 189 after the changes. The full diagnostic output is identical after normalizing source line/column offsets. Both commands exit 2 because of existing errors.
- `node --test app/ui/explore/address.test.ts app/ui/explore/page-copy.test.ts app/ui/related-map/map.test.ts`: 33 passed, zero failures.
- `goodwatch-benchmark/html-equivalence/run.sh local origin/main perf/html`: 116 paths × Googlebot, Bingbot and browser = 348 documents. Both sides repeat with zero stability differences. The strict cross-build gate correctly exits 1 for six changed documents: the two mood hubs for each client.
- A separate run against preview-only commit `144b57474` also checked 348 documents, with zero repeat-run differences and the same six intended cross-build changes. The `--previews-only` comparison passed, permitting only `results.slice(0, 8)` while preserving all section metadata.
- `html-weight/compare.mjs` independently checks all 348 documents of the final candidate. Outside the context script, normalized HTML is byte-identical, including visible markup, link order and destinations, JSON-LD, styles and non-loader scripts. Inside the context, every value equals the baseline after applying exactly the preview slicing and metadata projection. Status, redirect chain and cache policy also match.

The isolated fixture set contains 30 movies, 72 rendered show pages and no people. The movie mood row with the most results has 22 records; the show equivalent has 13, so the comparison actually exercises slicing beyond eight. Other rows and the existing leaf/people fixtures can be empty on both sides; the harness reports those cases. This validates a bounded fixture set, not every production title or member variant.

Local actual sizes from the final builds:

| Path | Client | Before raw | After raw | Before Brotli 11 | After Brotli 11 |
| --- | --- | ---: | ---: | ---: | ---: |
| `/movies/moods` | googlebot | 202,841 | 153,437 | 21,620 | 16,240 |
| `/movies/moods` | bingbot | 202,841 | 153,437 | 21,620 | 16,240 |
| `/movies/moods` | browser | 212,379 | 158,360 | 21,769 | 16,380 |
| `/shows/moods` | googlebot | 193,674 | 156,340 | 20,808 | 16,088 |
| `/shows/moods` | bingbot | 193,674 | 156,340 | 20,808 | 16,088 |
| `/shows/moods` | browser | 200,509 | 161,552 | 20,978 | 16,220 |

### Harness fixes and limits

The first build failed because the harness used an outdated dependency directory without the current FastStats export. It now uses this checkout’s installed webapp dependencies. `GW_HTML_CHECK_CACHE` lets this ticket keep generated worktrees, logs and response bodies under its scratch directory. The isolated runner starts builds and servers through `env -i`, pins keys empty and endpoints to loopback, blocks external egress, uses `WEBAPP_ROLE=page`, disables the page cache, and refuses dotenv files.

An initial expanded run stopped at `/movies/genres` on baseline: its uncached genre lookup requires TMDB and egress was blocked. The default offline additions therefore cover the movie and show mood hubs. Production captures and exact serialization projections cover genre and streaming hub bytes, but their new rendering was not verified locally. The existing unrelated fixture schema also lacks some streaming metadata. No production data or external access was added to make tests pass.

No scripts, styles, fonts, image markup, rendering counts or landing surfaces changed, so the conditional asset-budget and Lighthouse checks were not triggered. Browser hydration and authenticated member behavior were not tested in a real browser. The byte and equivalence checks do not establish a new Lighthouse score.

## Coverage gaps and owner decisions

The capture inventory covers route families, not all concrete URLs or pagination states. The first request for `/shows/moods/scary/2` was a 404 because paging uses `?page=2`; the supplemental capture includes the correct query form on the movie leaf. The old TV, search and taste-tab routes are redirects, not separate documents. Sitemap, OG, MCP, auth callbacks, action-only settings routes and export endpoints are resources, so HTML partition sizes do not apply.

Public profile requests using `alp82` returned 404, so profile, scores, seen, shows, wishlist, lists, stats and tropes lack a successful content sample. Valid public profile/list identifiers and a safe isolated member fixture remain needed. No authenticated session was supplied. Share-list GET loaders can materialize share cards; no valid share list was fetched because this task forbids production writes. The invalid-ID requests do not validate real list content. These limitations also apply to list editing and member-only settings. The draft blog detail returned 200 and provides a content sample, although it is not a listed/indexable post. The invalid explore address returned 404 and provides no successful content sample.

No product decision is required to merge these two reductions. If the owner wants fewer best-of rows per page, reducing 250 to 100 would remove roughly 230 KB of raw HTML per full page (about 150 × the current mean row markup plus title JSON), before the smaller JSON-LD list. That is an estimate, not a built change; it changes pagination and the crawl graph, so it needs a separate decision. Keeping all content while deduplicating styles or SVG is a technical follow-up that needs visual checks.

## Reproduce

Install dependencies in `goodwatch-webapp` with npm. Keep raw responses and generated logs outside Git. Use an absolute scratch path in place of `$scratch` below. The capture command always targets production, makes GETs only, and deliberately does not accept arbitrary hosts.

```sh
node goodwatch-benchmark/html-weight/measure.mjs capture goodwatch-benchmark/html-weight/paths.json "$scratch/prod"
node goodwatch-benchmark/html-weight/measure.mjs analyze "$scratch/prod"
node goodwatch-benchmark/html-weight/project.mjs "$scratch/prod" "$scratch/projected.json"
GW_HTML_CHECK_CACHE="$scratch/equivalence" goodwatch-benchmark/html-equivalence/run.sh local origin/main perf/html
node goodwatch-benchmark/html-weight/compare.mjs "$scratch/equivalence/run-..."
```

The strict gate remains strict: review its six intended loader differences with the separate comparison instead of adding an HTML allowlist. No changes were pushed or deployed.

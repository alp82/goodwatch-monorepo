# What the Search Console reports show (2026-10-11)

The owner read the reports that the API doesn't offer and exported them on 2026-10-11. This file records what they say. It answers the question of the ticket [Read the Search Console reports the API can't show](https://github.com/alp82/goodwatch-monorepo/issues/349): did Google assess the other pages and drop them, or has it had no working route to them?

## Answer

Mostly no route, and a small part assessed and dropped.

- **No penalty.** Manual actions and Security issues both report nothing.
- **Google knows about 120 URLs of the site**, not thousands: 1 indexed and 119 not indexed. The sitemap alone lists 1,096.
- **Of those 119, Google fetched 84 and chose not to index them** ("Crawled - currently not indexed"). The other 35 are pages that point at another address: 28 with a canonical elsewhere, 7 redirects.
- **Google fetches about 1.4 pages a day.** With that, it can't get to know the site whatever the pages are worth.
- **A title page that Google fetches today is fine:** the live test finds it indexable, with the right title, its own canonical, and 64 links to related titles.

So the work already done (sitemap, redirects, links on the start page) addresses the larger part. The 84 pages that were fetched and declined are the part that says quality also counts; which pages they are is not known, because the export has no example URLs.

## Page indexing

Files: [daily counts](gsc-page-indexing-daily-2026-10-11.csv), [reasons](gsc-page-indexing-reasons-2026-10-11.csv). The report covers 2026-07-24 to 2026-10-04, for all known pages.

- **Indexed: 1 on every day of the report.** The start page was the only indexed page for the whole period, so the drop to one page happened before 2026-07-24.
- **Not indexed fell from 4,575 to 119:**

  | From | Not indexed |
  |---|---|
  | 2026-07-24 | 4,575 |
  | 2026-07-25 | 1,224 |
  | 2026-08-18 | 352 |
  | 2026-09-15 | 291 |
  | 2026-09-19 to 2026-09-21 | 25,551 |
  | 2026-09-22 | 119 |

  Google has been forgetting the site's URLs, not only declining to index them. The three days at 25,551 are unexplained. They end on the day of the last sitemap download before the resubmission (2026-09-22).
- **Reasons on 2026-10-04:**

  | Reason | Pages | Validation |
  |---|---|---|
  | Crawled - currently not indexed | 84 | Failed |
  | Alternative page with proper canonical tag | 28 | Not started |
  | Page with redirect | 7 | Not started |
  | Soft 404 | 0 | |
  | Duplicate without user-selected canonical | 0 | Passed |
  | Discovered - currently not indexed | 0 | Passed |

- **"Discovered - currently not indexed" is 0.** Google has no queue of GoodWatch URLs that it knows and hasn't fetched. That fits the API's answer of 2026-10-06 and 2026-10-10 for the sample: "URL is unknown to Google".
- **"Soft 404" is 0**, so the redirects of unknown paths to hubs had not produced that verdict by the time they were removed.
- **Impressions** in the same file fall from about 100 a day at the end of July to about 15 a day from late August.

**Missing:** the example URLs per reason. The export has the counts only. The 84 "Crawled - currently not indexed" URLs would say what kind of page Google declines.

## Crawl stats

Files: [daily requests](gsc-crawl-stats-daily-2026-10-11.csv), [breakdowns](gsc-crawl-stats-breakdown-2026-10-11.csv). The report covers 2026-07-13 to 2026-10-06, 86 days.

- **1,803 requests in 86 days, 21 a day.** On 17 days there was none.
- **Few of them are pages.** Googlebot Smartphone and Desktop together are 6.6% of the requests, about 119 in 86 days. 70% are "Page resource load", the script and style files of a page being rendered, and 23% are images. By file type, 58% is JavaScript and 18% HTML.
- **92% of requests refresh something known; 8% discover something new.**
- **Responses:** 92.3% 200, 3.9% 302, 2.1% 304, 1.2% server errors, 0.4% 301, 0.2% 404. 1.4% of requests failed without a file type.
- **Host status for goodwatch.app: "Problems in the past".**
- **Slow days:**

  | Date | Requests | Average response |
  |---|---|---|
  | 2026-08-12 | 32 | 3.7 s |
  | 2026-08-21 | 28 | 4.9 s |
  | 2026-09-29 | 2 | 1.4 s |
  | 2026-09-30 | 26 | 1.8 s |
  | 2026-10-01 | 13 | 15.8 s |

  A usual day is 0.2 to 0.4 s.
- **Around the crawler flood of 2026-10-03 and 2026-10-04:** Google made 41 requests on 2026-10-03 at a 171 ms average, then 1 on 2026-10-04, 1 on 2026-10-05, and 34 on 2026-10-06. The report doesn't give response codes per day, so whether Google met closed connections on those days is not shown. The slow day that stands out is 2026-10-01, two days before the flood, followed by a day without requests.

## Live URL tests

Run on 2026-10-11 with "Test live URL", as Googlebot Smartphone, on one movie page (`/movie/1368337-the-odyssey`) and one show page (`/show/63247-westworld`), both in the sitemap.

| | Movie page | Show page |
|---|---|---|
| Verdict | URL is available to Google | URL is available to Google |
| Crawl allowed, fetch, indexing allowed | Yes, successful, yes | Yes, successful, yes |
| Rendered title | The Odyssey (2026): Where to Stream and Ratings \| GoodWatch | Westworld (2016): Where to Stream and Ratings \| GoodWatch |
| Declared canonical | Its own address | Its own address |
| `h1` | The Odyssey | Westworld |
| Related titles in the rendered HTML | 64 links under "Titles like The Odyssey" | 64 links under "Titles like Westworld" |
| Structured data blocks | Movie, FAQPage | TVSeries, FAQPage |
| Enhancements | None | None |

- **Related titles are in the server's HTML**, not only in the rendered page: the same 64 links are in a plain fetch of the show page.
- **Two of 63 page resources were blocked by `robots.txt`** on the show page: `/api/poster-impressions` and `/api/related-map`. Neither carries the links. Without the second, the related titles map shows Googlebot its waiting line ("Its traits are on their way.") in place of the comparison.
- **One console message:** a warning from the carousel library that a loop has too few slides.
- **"URL has no enhancements":** Google finds no rich result in the structured data. The blocks are read; they earn no special display.

The live test doesn't check discovery, and it says the page is indexed "only if certain conditions are met". It shows that a fetched title page has nothing that stops indexing.

## Indexing requests

Requested on 2026-10-11: `/movies`, `/shows`, `/discover`, `/explorer`, the movie page and the show page above. Not requested: mood pages.

The weekly index record samples the four hubs, so it shows whether the requests had an effect.

## What this changes

- **The gate still decides.** Nothing here says pages will stay indexed; it says Google has had almost nothing to judge. The weekly record after the sitemap download is the test.
- **Watch the crawl rate, not only the index state.** At 1.4 pages a day, 1,096 sitemap URLs take two years. If the rate doesn't rise in the weeks after the resubmission, the index record can't fill, and the question becomes why Google spends so little on the host ("Problems in the past", the slow days).
- **Get the 84 URLs.** In the Page indexing report, open "Crawled - currently not indexed" and export from there; that export has the URLs.

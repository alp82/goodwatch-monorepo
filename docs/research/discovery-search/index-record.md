# Weekly index record

A weekly measurement of how Google sees a fixed sample of 50 goodwatch.app URLs.
It is the evidence for the gate of the map in issue #347: whether Google keeps GoodWatch's pages has to be read from this record, not guessed.
Issue #353 asks for the baseline and at least four weekly runs after Google downloads the new sitemap.

## Run it

Once a week, by hand (owner decision 2026-10-10: no schedule):

```
cd goodwatch-webapp/scripts
make index-record        # runs: uv run gsc_sample.py
```

Then commit the three changed CSV files and add the date to "Runs" below.

- `GSC_KEY_FILE` must point at a read-only Search Console service account key. Set it in `goodwatch-webapp/scripts/.env` (ignored by git) or in the environment. Keep the key outside the repo.
- A second run on the same date is refused. `uv run gsc_sample.py --force` appends it anyway.
- A run makes 50 URL Inspection calls (quota 2,000 per day) and takes about a minute. Nothing is written unless every call succeeds.

## Files

| File | One row per | Columns |
| --- | --- | --- |
| `index-sample.csv` | sample URL | kind, url |
| `index-record.csv` | run and sample URL | run_date, kind, url, verdict, coverageState, indexingState, pageFetchState, robotsTxtState, lastCrawlTime, googleCanonical, userCanonical |
| `index-record-traffic.csv` | run and URL shape | run_date, startDate, endDate, shape, pages, impressions, clicks |
| `index-record-sitemaps.csv` | run and submitted sitemap | run_date, path, lastSubmitted, lastDownloaded, isPending, errors, warnings |

The record files are append-only.

**The sample never changes.** `index-sample.csv` was fixed on 2026-10-10: the start page, 6 hubs, 8 mood and genre pages, 25 titles (17 movies, 8 shows) from the sitemap of that day, 5 person pages, 5 old URL shapes.
The titles are the 11 from `gsc-url-inspection-2026-10-06.csv` that were still in the sitemap, plus 14 spread across the popularity order.
A title that later leaves the sitemap stays in the sample.

Traffic covers 7 days ending 3 days before the run, because Search Analytics data arrives two to three days late. Each row states its window.
Pages are counted by shape on `https://goodwatch.app`: `start`, `title_movie` (`/movie/...`), `title_show` (`/show/...`), `person`, `category_hub` (`/movies`, `/shows`, `/discover`, `/explorer` and everything under `/movies/` and `/shows/`), and `other` (everything else, including old shapes such as `/tv/...` and other hosts).
`pages` is the number of different pages with at least one impression.

## Key dates for the gate

| Event | Date |
| --- | --- |
| Sitemap resubmitted in Search Console | not yet |
| Google downloads the new sitemap (`lastDownloaded` moves past 2026-09-22) | not yet |
| Redirect change deployed | not yet |
| Start page change deployed | not yet |

## Runs

| Run | Note |
| --- | --- |
| 2026-10-10 | Baseline |

## Baseline, 2026-10-10

- Coverage: 1 of 50 "Submitted and indexed" (the start page), 49 of 50 "URL is unknown to Google". No URL is in any other state.
- The 49 unknown URLs have no crawl time and no Google canonical. That covers all 6 hubs, 8 mood and genre pages, 25 titles, 5 person pages and 5 old shapes.
- 31 sample URLs were also inspected on 2026-10-06. All 31 have the same coverage state as then (start page indexed, 30 unknown). The only change: the start page's last crawl moved from 2026-10-04 to 2026-10-08.
- Traffic 2026-10-01 to 2026-10-07: 119 impressions and 7 clicks, all on the start page. No other page had an impression.
- One sitemap is submitted, `/sitemaps/sitemap.xml`: submitted 2025-03-01, last downloaded 2026-09-22, no errors or warnings.

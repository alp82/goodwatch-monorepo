# Weekly index record

A weekly measurement of how Google sees a fixed sample of 50 goodwatch.app URLs.
It is the evidence for the gate of the map in issue #347: whether Google keeps GoodWatch's pages has to be read from this record, not guessed.
Issue #353 asks for the baseline and at least four weekly runs after Google downloads the new sitemap.

## Run it

The [index-record workflow](../../../.github/workflows/index-record.yml) runs automatically every Saturday at 06:00 UTC once installed on `main`. It appends the three record CSVs and commits them to `main` with the run date and `#353`. This replaces the earlier manual-only schedule. Each weekly push also triggers the accepted Coolify deployment.

To trigger it by hand from the repository:

```sh
gh workflow run index-record.yml
```

Setup: add the repository Actions secret `GSC_SERVICE_ACCOUNT_JSON` containing the complete read-only Search Console service account JSON key. The workflow writes it privately under `$RUNNER_TEMP`, sets `GSC_KEY_FILE`, and removes the temporary file when sampling finishes. Do not commit the key. Actions must be enabled, repository/organization policy must allow the workflow's explicit `contents: write` permission, and `main` branch rules must permit its `GITHUB_TOKEN` push. No personal access token is needed.

Manual local run is the fallback:

```
cd goodwatch-webapp/scripts
make index-record        # runs: uv run gsc_sample.py
```

For a local run, commit the three changed record CSV files. The CSVs are the complete run history; the "Runs" table and summaries below are maintained by hand when interpreting results.

- `GSC_KEY_FILE` must point at a read-only Search Console service account key. Set it in `goodwatch-webapp/scripts/.env` (ignored by git) or in the environment. Keep the key outside the repo.
- A second run on the same date is refused (exit status 3); the workflow treats only that refusal as a successful skip. Other failures fail the job. `uv run gsc_sample.py --force` appends it anyway locally; the workflow never uses it. Workflow dates use UTC.
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
| Sitemap resubmitted in Search Console | 2026-10-10 |
| Google downloads the new sitemap (`lastDownloaded` moves past 2026-09-22) | 2026-10-10 |
| Redirect change deployed | 2026-10-10 |
| Start page change deployed | 2026-10-10 |

## Runs

| Run | Note |
| --- | --- |
| 2026-10-10 | Baseline |
| 2026-10-15 | First run after the sitemap download: 1 indexed, 3 hubs crawled and not indexed, 46 unknown |

## Baseline, 2026-10-10

- Coverage: 1 of 50 "Submitted and indexed" (the start page), 49 of 50 "URL is unknown to Google". No URL is in any other state.
- The 49 unknown URLs have no crawl time and no Google canonical. That covers all 6 hubs, 8 mood and genre pages, 25 titles, 5 person pages and 5 old shapes.
- 31 sample URLs were also inspected on 2026-10-06. All 31 have the same coverage state as then (start page indexed, 30 unknown). The only change: the start page's last crawl moved from 2026-10-04 to 2026-10-08.
- Traffic 2026-10-01 to 2026-10-07: 119 impressions and 7 clicks, all on the start page. No other page had an impression.
- One sitemap is submitted, `/sitemaps/sitemap.xml`: submitted 2025-03-01, last downloaded 2026-09-22, no errors or warnings.

## Run 2026-10-15

- Coverage: 1 of 50 "Submitted and indexed" (the start page), 3 "Crawled - currently not indexed", 46 "URL is unknown to Google".
- The 3 crawled URLs are the hubs `/shows`, `/discover` and `/explorer`, all crawled on 2026-10-11. They were unknown at the baseline. All titles, person pages, mood and genre pages and old shapes are still unknown.
- Traffic 2026-10-06 to 2026-10-12: 160 impressions and 1 click, all on the start page.
- The sitemap was last downloaded on 2026-10-10, at the resubmission, with no errors or warnings.

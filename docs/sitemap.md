# Sitemap

How the sitemap files in `goodwatch-webapp/public/sitemaps/` are made, checked, and published. Built for [Regenerate the sitemap with honest dates, on a schedule](https://github.com/alp82/goodwatch-monorepo/issues/351).

Public member profiles are held out of the sitemap until they have an intended internal discovery route.
`PROFILES_IN_SITEMAP = False` in `scripts/sitemap_profiles.py` gates selection, writing and index inclusion, including
the generator downloaded by the Saturday Windmill run. Profile pages keep their existing indexing policy.

## The weekly schedule

```sh
cd goodwatch-webapp/scripts
make sitemaps-checked
```

Windmill runs `f/seo/regenerate_sitemaps` automatically every Saturday at **03:00 UTC** with `dry_run: false`. The schedule lives in Windmill only, like the other schedules, and is not deployed from git; change it in the Windmill UI. The command above remains the manual fallback.

Deploy the updated `f/seo/regenerate_sitemaps` wrapper with these generator changes: it must download the previous XML artifacts, the selection/person/blog helpers, and the blog post list. The weekly schedule itself is unchanged.

The job downloads the existing generator, its helpers, category definitions, blog post list (`goodwatch-webapp/app/content/blog/posts.json`), and URL checker from one pinned `main` revision. Each file keeps its repository path, so the generator finds them where it finds them locally. The job fails when one of them is missing on `main`. It uses the existing `u/Alp/CRATE_HOSTS`, `u/Alp/CRATE_USER`, and `u/Alp/CRATE_PASS` workspace variables; it does not keep a second copy of the generation or checking rules.

The job reads the GitHub token from the secret Windmill workspace variable **`u/Alp/GITHUB_SITEMAP_TOKEN`**, which the schedule's execution identity must be able to read. Use a fine-grained GitHub personal access token restricted to **alp82/goodwatch-monorepo**, with **Contents: read and write** (and GitHub's required Metadata read access). No workflow or administration permissions are needed. The token's identity must be allowed to commit to `main`; repository rules can reject that operation. Keep the value out of git and renew it before expiry.

The scheduled invocation sets `dry_run: false`. Preview/manual invocations default to `dry_run: true`: they generate and run the full live check, report the URL count and changed paths, and never retrieve the GitHub token or write to GitHub. Allow about 50 minutes; the job timeout is four hours.

The command takes about 50 minutes and does three things:

1. It writes the sitemap files to a temporary directory.
2. It reads the live `robots.txt`, then requests every listed URL on https://goodwatch.app once, 2 seconds apart. A URL passes when it answers 200 without a redirect, the page's `<link rel="canonical">` equals the listed URL, neither a robots meta tag nor an `X-Robots-Tag` header says `noindex`, and `robots.txt` lets Googlebot fetch it. A URL that `robots.txt` disallows fails without being requested. A page whose HTML is larger than 2 MB gets a warning but passes: Google reads only the first 2 MB, so links and text after that point are lost.
3. When every URL passes, it replaces the files in `public/sitemaps/`. When one fails, it changes nothing, prints each failing URL with its reason, and names the directory that holds the rejected files.

## What it needs

- `uv` and `make`.
- `goodwatch-webapp/scripts/.env` (or `goodwatch-webapp/.env`) with `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER`, and `CRATE_PASS` for the production database. The generator only reads.
- Network access to the database and to https://goodwatch.app.

The static landing URLs include `/hot` and `/map`. Change the generator and committed static XML together; the live check rejects redirect sources. `/watch/*` stays out of the sitemap and carries `noindex, follow`.

## Publishing

The files are tracked in git, and every update to `main` deploys the webapp through the existing Coolify integration.

On a passing scheduled run, Windmill uses the GitHub Git API to create a single commit containing only changed `public/sitemaps/sitemap*.xml` files (including removal of obsolete generated files). The message is `chore(seo): regenerate the sitemap on <UTC date> (#351)`. Unchanged output produces no commit. A failed check fails the job visibly and publishes nothing. A concurrent change to `main` makes publication fail safely; rerun with fresh sources. Review failures in the Windmill job log.

For the manual fallback:

1. Review the change with `git diff goodwatch-webapp/public/sitemaps`.
2. Commit the files and push to `main`.
3. If the set of files that `sitemap.xml` lists has changed, the owner resubmits `https://goodwatch.app/sitemaps/sitemap.xml` in Search Console. Changed URLs or dates inside the listed files need no resubmission.

## What the files list

| File | Content |
| --- | --- |
| `sitemap.xml` | The index that Search Console has. It lists the URL sets below (public member profiles are held out). |
| `sitemap_static.xml` | The landing pages, then `/blog` and every blog post. |
| `sitemap_categories.xml` | The category pages of movies and shows. |
| `sitemap_movie_detail_0.xml` | 700 movie pages. |
| `sitemap_show_detail_0.xml` | 300 show pages. |
| `sitemap_people.xml` | 30 stable cast/director pages linked from the selected title cohort. |
| `sitemap_profiles.xml` | Held out until public profiles have an intended internal discovery route; no file is generated. |
| `sitemap_index_movie_detail.xml`, `sitemap_index_show_detail.xml` | Legacy indexes, kept for their earlier Search Console submissions. |

### Title selection and stability

The owner-approved policy (2026-10-18) retains the vote (>5,000), poster, release-year and 30-day details freshness checks. It requires a nonempty synopsis, release/first-air date no later than selection time, adult not true, normalized overall score at least 60, and movie status Released. Shows exclude Talk, News, Soap and Reality, plus Kids with 300 or more episodes. Unknown adult flags remain eligible; unknown release dates do not.

The initial cohort fills 630 movie and 270 show core slots by aggregate GoodWatch vote count descending (TMDB ID ascending for ties), then 70 and 30 attention slots by TMDB popularity descending from the rest. Those measures are cross-source aggregate votes and popularity, respectively.

A `goodwatch-selection` JSON comment in each committed title sitemap records policy version, core IDs, attention IDs and attention review month. Both commands read the previous committed XML; no independent state store or database writes are needed. A sitemap without the comment bootstraps the approved policy once. Corrupt or inconsistent state fails generation rather than silently resetting the cohort.

Eligible core members are retained indefinitely, even when their ranking drops. There are **zero discretionary core replacements**. Missing or newly ineligible members are replaced immediately by eligible vote-ranked titles, preserving attention occupants where possible. Attention members are retained within the UTC calendar month. The first successful run of a new month reviews popularity and replaces at most 35 movies and 15 shows (5% of each total); mandatory ineligibility replacements are exempt from that discretionary cap. Vacancies are filled immediately. A failed live check publishes neither files nor selection state, so a failed monthly review can be retried.

The 30-day freshness filter stays in effect as requested. Investigate/refresh an established title before accepting a freshness-only removal. Broken, redirected or otherwise failing live pages block publication; fix/refresh their catalog data and rerun. The generator does not hide live failures by silently dropping URLs.

### Person pages

Thirty people are selected from top-five billed cast and directors of the selected title cohort. A person needs distinct credits on at least three cohort titles, a nonempty name, a portrait, positive popularity and adult not true. That provides substantive filmography pages and links from the selected titles. The initial list ranks by person popularity descending, then TMDB ID ascending; duplicate people and duplicate credits do not consume slots. Existing eligible members from `sitemap_people.xml` remain indefinitely; only vacancies are filled. Person URL entries omit lastmod. Every URL passes the same live status/canonical gate before publication; a failed person URL blocks the entire run.

### Member profiles

`sitemap_profiles.py` currently returns no profiles, without reading member data. The writer removes a stale profile
file and the index excludes it even if a caller supplies an old profile lastmod. Windmill downloads these rules
from its pinned `main` revision each Saturday, so a new run cannot restore profiles after this change reaches `main`.
The retained eligibility rules are dormant; public profile routes and their indexability are unchanged.

### Blog posts

`goodwatch-webapp/app/content/blog/posts.json` is the single list of blog posts. Each entry has a `slug`, a `published` date, and an `updated` date, as `YYYY-MM-DD`, and optionally `"draft": true`. `sitemap_blog.py` reads it, and `create_sitemaps.py` adds the URLs of the posts that aren't drafts to `sitemap_static.xml` after the landing pages:

1. `https://goodwatch.app/blog`, dated with the newest `updated` date of those posts.
2. `https://goodwatch.app/blog/<slug>` for each of them, sorted by slug, dated with its own `updated` date.

A draft renders at its address with robots `noindex, nofollow`, for a preview, and is left out of the sitemap, of `/blog` and of the feed. `/blog` without a listed post is `noindex` too, so it stays out of the sitemap until the first post is published. Publishing a post means removing its `draft` flag and setting its dates.

A post's author sets `updated` only when the post visibly changes, so the date is evidence of a visible change, as the dating rule requires. The blog index lists the posts, so it changes visibly whenever a post is added or updated, and the newest `updated` date dates that change. Without the file, with an empty list, or with drafts only, the set has no blog URLs.

Generation fails, and writes no static set, when an entry has a slug that does not match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, a date that is not a real `YYYY-MM-DD` day, an `updated` date before `published`, a `draft` value that isn't `true` or `false`, or a slug that another entry already has. A published post's `updated` date also may not be after today (UTC). Fix `posts.json` and rerun.

The blog URLs are part of the existing static set, so the files that `sitemap.xml` lists stay the same and Search Console needs no resubmission. Blog URLs pass the same live check as every other URL: each page must answer 200 with a canonical link equal to its listed URL.

### Count policy

The title cap stays at **1,000 until at least 70% of listed titles are indexed**. After that threshold, add **250 titles at a time**, reviewing indexing before each further increase. This is an operating rule, not automatic growth logic.

Which titles are listed, and why, is explained in `goodwatch-webapp/scripts/sitemap_query.py`. A title page answers 404 once TMDB deletes its id, and only a new run drops it. That is the reason for the weekly run.

## Dates

Title entries omit `<lastmod>` until there is evidence of a significant visible content change. `tmdb_details_updated_at` records refreshes, and `dna_updated_at` also advances for vector repairs with unchanged visible analysis. Neither proves a visible change. The September 25 rebuild floor has been removed; it must not fabricate dates for titles without reliable content timestamps. Landing page and category URL entries also remain undated. Blog URLs are the exception, see below.

An index entry dates the referenced XML file, independently of its pages. The generator snapshots the previous files and their index dates before writing. A byte change (including a changed URL, membership or date) gets today's UTC date; identical bytes retain the previous index date. An unchanged file without a known previous date stays undated until its first observed change. Both master and legacy indexes use this rule.

The manual command compares against `public/sitemaps/`, including when `--output-dir` writes to a temporary directory. Use `--previous-dir` to override the baseline. Windmill downloads the previous XML files from the same pinned `main` revision as the generator. No filesystem modification times or maximum title dates are used.

### Timestamp investigation (2026-10-18)

Read-only CrateDB queries using the unchanged selection found DNA timestamps for all 700 movies and 300 shows (681 movies and 291 shows dated September 25 or later). Catalog-wide, 164,614 of 1,262,680 movies and 87,126 of 234,765 shows had DNA timestamps. The copy reads MongoDB's `updated_at`; `f/dna/generate/vectors.py` and `release_fresh_dna` in `f/dna/generate/fetch.py` advance it when storing repaired vectors, even without changing the analysis. Analysis generation also saves without a significant-content equality comparison. A current database snapshot cannot establish which historical updates changed visible content, so **zero of the 1,000 title entries retain a date**.

A content-hash-based timestamp is worth building later: compare a normalized set of significant public fields when publishing title data, update the timestamp only when that hash changes, and cover independent analysis, metadata, offers and episode updates. Exclude fetch clocks and incidental popularity fluctuations. Define significance for rating/availability changes before implementation, and handle genuine shared-template changes with evidenced deployment dates. Hashing remains future work; selection is governed separately by the policy above.

## Other commands

- `make sitemaps` writes the files straight into `public/sitemaps/`, without the check.
- `uv run check_sitemap_urls.py` checks the files that are in `public/sitemaps/` now.
- `make sitemaps-test` runs the unit tests. They need no database and no network.

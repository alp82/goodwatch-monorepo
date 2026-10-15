# Sitemap

How the sitemap files in `goodwatch-webapp/public/sitemaps/` are made, checked, and published. Built for [Regenerate the sitemap with honest dates, on a schedule](https://github.com/alp82/goodwatch-monorepo/issues/351).

## The weekly schedule

```sh
cd goodwatch-webapp/scripts
make sitemaps-checked
```

Windmill runs `f/seo/regenerate_sitemaps` automatically every Saturday at **03:00 UTC** with `dry_run: false`. The schedule lives in Windmill only, like the other schedules, and is not deployed from git; change it in the Windmill UI. The command above remains the manual fallback.

The job downloads the existing generator, its helpers, category definitions, and URL checker from one pinned `main` revision. It uses the existing `u/Alp/CRATE_HOSTS`, `u/Alp/CRATE_USER`, and `u/Alp/CRATE_PASS` workspace variables; it does not keep a second copy of the generation or checking rules.

The job reads the GitHub token from the secret Windmill workspace variable **`u/Alp/GITHUB_SITEMAP_TOKEN`**, which the schedule's execution identity must be able to read. Use a fine-grained GitHub personal access token restricted to **alp82/goodwatch-monorepo**, with **Contents: read and write** (and GitHub's required Metadata read access). No workflow or administration permissions are needed. The token's identity must be allowed to commit to `main`; repository rules can reject that operation. Keep the value out of git and renew it before expiry.

The scheduled invocation sets `dry_run: false`. Preview/manual invocations default to `dry_run: true`: they generate and run the full live check, report the URL count and changed paths, and never retrieve the GitHub token or write to GitHub. Allow about 50 minutes; the job timeout is four hours.

The command takes about 50 minutes and does three things:

1. It writes the sitemap files to a temporary directory.
2. It requests every listed URL on https://goodwatch.app once, 2 seconds apart. A URL passes when it answers 200 without a redirect and the page's `<link rel="canonical">` equals the listed URL.
3. When every URL passes, it replaces the files in `public/sitemaps/`. When one fails, it changes nothing, prints each failing URL with its reason, and names the directory that holds the rejected files.

## What it needs

- `uv` and `make`.
- `goodwatch-webapp/.env` with `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER`, and `CRATE_PASS` for the production database. The generator only reads.
- Network access to the database and to https://goodwatch.app.

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
| `sitemap.xml` | The index that Search Console has. It lists the four URL sets below. |
| `sitemap_static.xml` | The landing pages. |
| `sitemap_categories.xml` | The category pages of movies and shows. |
| `sitemap_movie_detail_0.xml` | 700 movie pages. |
| `sitemap_show_detail_0.xml` | 300 show pages. |
| `sitemap_index_movie_detail.xml`, `sitemap_index_show_detail.xml` | Legacy indexes, kept for their earlier Search Console submissions. |

Person pages are not listed.

Which titles are listed, and why, is explained in `goodwatch-webapp/scripts/sitemap_query.py`. A title page answers 404 once TMDB deletes its id, and only a new run drops it. That is the reason for the weekly run.

## Dates

A title's `<lastmod>` is the later of two dates: the last change of its data (TMDB details or fingerprint), and 2026-09-25, the day all title pages were rebuilt. The second date is `TITLE_PAGE_REBUILT_ON` in `goodwatch-webapp/scripts/sitemap_lastmod.py`. Raise it when all title pages change again.

## Other commands

- `make sitemaps` writes the files straight into `public/sitemaps/`, without the check.
- `uv run check_sitemap_urls.py` checks the files that are in `public/sitemaps/` now.
- `make sitemaps-test` runs the unit tests. They need no database and no network.

# Sitemap

How the sitemap files in `goodwatch-webapp/public/sitemaps/` are made, checked, and published. Built for [Regenerate the sitemap with honest dates, on a schedule](https://github.com/alp82/goodwatch-monorepo/issues/351).

## The weekly command

```sh
cd goodwatch-webapp/scripts
make sitemaps-checked
```

It is run by hand, once a week. There is no schedule: the owner decided on 2026-10-10 to keep it manual for now.

The command takes about 50 minutes and does three things:

1. It writes the sitemap files to a temporary directory.
2. It requests every listed URL on https://goodwatch.app once, 2 seconds apart. A URL passes when it answers 200 without a redirect and the page's `<link rel="canonical">` equals the listed URL.
3. When every URL passes, it replaces the files in `public/sitemaps/`. When one fails, it changes nothing, prints each failing URL with its reason, and names the directory that holds the rejected files.

## What it needs

- `uv` and `make`.
- `goodwatch-webapp/.env` with `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER`, and `CRATE_PASS` for the production database. The generator only reads.
- Network access to the database and to https://goodwatch.app.

## Publishing

The files are tracked in git, and every push to `main` deploys the webapp.

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

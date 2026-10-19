# The streaming study

The first GoodWatch data study, published at [`/blog/streaming-by-country-2026`](https://goodwatch.app/blog/streaming-by-country-2026). It counts where 4,683 well-known movies and 717 well-known shows stream in 139 countries. The decisions behind it are in [`streaming-study-proposal.md`](streaming-study-proposal.md).

## Files

| File | What it is |
| --- | --- |
| `goodwatch-webapp/scripts/streaming_study.py` | Reads the titles and a fresh TMDB snapshot, and writes the files below. |
| `goodwatch-webapp/scripts/streaming_study_analysis.py` | The counting rules: brand folding, services that don't count, library and ad-supported offers, the best-rated cut. No network. |
| `goodwatch-webapp/scripts/test_streaming_study.py` | Unit tests for those rules. |
| `goodwatch-webapp/app/content/blog/streaming-by-country-2026/data.json` | The counts the page shows. Generated; don't edit by hand. |
| `goodwatch-webapp/app/content/blog/streaming-by-country-2026/post.mdx` | The post's text. Every number in it comes from `data.json`. |
| `goodwatch-webapp/public/downloads/streaming-by-country-2026/*.csv` | The two downloads, under CC BY 4.0. Generated. |
| `goodwatch-webapp/app/ui/blog/study-charts.ts` | Which countries each chart shows, and the question, answer and note around it. |

The downloads are under `public/downloads/`, not `public/blog/`. A folder under `public/blog/` makes `/blog` a directory, and the static file server then redirects `/blog` to `/blog/`.

## Run it again

The study reads only. It runs one query per media type on CrateDB and about 5,700 GET requests on TMDB's API, in about 5 minutes.

```sh
cd goodwatch-webapp/scripts
make streaming-study-test
python3 streaming_study.py --crate-env path/to/scripts/.env --tmdb-env path/to/goodwatch-webapp/.env
```

- `--crate-env` is a `.env` file with `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER` and `CRATE_PASS`. It defaults to `scripts/.env`.
- `--tmdb-env` is a `.env` file with `TMDB_API_KEY`, used when the key isn't in the environment. It defaults to `goodwatch-webapp/.env`.
- `--reuse` rebuilds the files from the last snapshot without reading anything.

The raw snapshot stays in `~/.cache/goodwatch-streaming-study/study-snapshot.json`, outside the repository. TMDB's terms limit caching to six months, and the raw snapshot is JustWatch's offer data. The repository keeps only counts.

After a new run:

1. Read the printed findings and compare the post's sentences with them. Sentences built from `data.json` follow the numbers. Words that describe them, such as "the US streams the most", don't.
2. Update `published` or `updated` in `goodwatch-webapp/app/content/blog/posts.json`, and the title in `posts.json` and in `STATIC_PAGE_COPY` (`app/ui/og-image/copy.ts`) if the headline number changed. `study-charts.test.ts` checks that the two titles match. The post's text has its numbers written out, so check them against the printed findings too.

## Draft and publishing

The post is a draft (`"draft": true` in `posts.json`, 2026-10-19): it renders at `/blog/streaming-by-country-2026` with robots `noindex, nofollow` and a draft notice, and it isn't on `/blog`, in the feed or in the sitemap. `/blog?drafts` shows its index card for a preview; that view is never indexed. To publish, remove `draft`, set `published` and `updated` to the publication day, and deploy; the next weekly sitemap run lists it.

The text is the Fable draft the owner chose, `post.mdx`; its topical references are sourced in `sources.md` next to it, which the site doesn't render.
3. Run `npm test` in `goodwatch-webapp`.

## What was checked by hand

The [hand checks of 2026-10-19](streaming-study/hand-checks.md) compared the main findings with the services' own pages before publication, and say what couldn't be confirmed. The proposal's "Hand checks" table says what each one changed in the post. A new edition repeats them.

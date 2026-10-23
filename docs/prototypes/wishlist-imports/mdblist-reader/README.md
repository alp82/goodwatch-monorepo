# MDBList Watchlist reader (prototype, #711)

A local, read-only command that reads a member's MDBList personal Watchlist and writes a [shared wishlist file](../../../implementation/shared-wishlist-format.md) (version 1.1) for the GoodWatch Imports page. It calls one route, `GET https://api.mdblist.com/watchlist/items`, with cursor pagination. It never calls a write route and needs no OAuth app.

Gates: [GATES.md](GATES.md), committed before the reader was written. Results: [VALIDATION.md](VALIDATION.md).

## Run the tests

You need Node.js 22.18 or later (Node 24 recommended). No `npm` install is needed.

```sh
node --test docs/prototypes/wishlist-imports/mdblist-reader/reader.test.mjs
```

The tests use a fake MDBList server (`fake-mdblist.mjs`) with the synthetic fixture (`fixtures/synthetic-watchlist.json`), and they parse each written file with the shipped `parseWishlistFile`.

## Read a real Watchlist

The API key stays on your computer. Only the sanitized shape report and the aggregate counts come back to the ticket.

1. On mdblist.com, make sure your Watchlist has at least 6 entries, so `--limit 2` reads a first, a middle, and a final page. If you can, include a movie, a show, two works with the same title (for example, both "Dune" films), a title you've Seen in GoodWatch, and a season or episode.
2. Write down how many movies and how many shows your Watchlist shows on mdblist.com. This is the reference count.
3. Copy your API key from mdblist.com **Preferences**, then save it to the key file. The `read` command waits for you to paste the key. It doesn't echo the key or put it in your shell history:

   ```sh
   mkdir -p ~/goodwatch-private/711 && chmod 700 ~/goodwatch-private/711
   read -rs KEY && printf '%s' "$KEY" > ~/goodwatch-private/711/mdblist-api-key && unset KEY
   chmod 600 ~/goodwatch-private/711/mdblist-api-key
   ```

   In fish, replace the second line with `read -s KEY; and printf '%s' $KEY > ~/goodwatch-private/711/mdblist-api-key; and set -e KEY`.

4. Run the reader. `--limit 2` forces pagination for the experiment; leave it out for normal use (100 per page). `--cross-check` reads each media type again to compare against the combined read.

   ```sh
   node docs/prototypes/wishlist-imports/mdblist-reader/reader.mjs --limit 2 --cross-check
   ```

5. Compare the summary line with your reference count: does the number of movies and shows match your Watchlist, and were any entries missing? Report only those counts and `~/goodwatch-private/711/mdblist-shape-report.json`.

The reader writes two files, both mode 600:

- `~/goodwatch-private/711/mdblist-watchlist.json`: the wishlist file. It holds titles and IDs, so it stays private. Uploading it to the Imports page for a preview is optional; capture validation doesn't need it.
- `~/goodwatch-private/711/mdblist-shape-report.json`: field names, types, counts, cursor placement, request counts, and rate-limit headers. It holds no key, titles, IDs, or cursor values; any field name or text containing the key is replaced with `[redacted]`. It's safe to share.

Before writing, the reader checks both files for the key. An unknown list named after the key is written as `unsupported:[redacted]`. If the key would still appear, for example inside a title, the reader writes neither file and exits with code `2`.

Exit code `0` means both files were written; the summary line says the coverage (`complete`, `partial`, or `unknown`). Exit code `2` means no wishlist file was written and the previous one stays as it was.

Options: `--key-file`, `--out`, `--report`, `--limit 1..1000`, `--cross-check`. The `MDBLIST_API_KEY` environment variable overrides the key file. The reader refuses to write inside a Git work tree (a `.git` folder with `HEAD`, or a `.git` file starting with `gitdir:`), also through symlinks. Requests send `User-Agent: goodwatch-mdblist-reader/0.2`. The wishlist file, the report, and the key file must be three different files. The reader stages both outputs first and replaces the wishlist last, so a failed write leaves the previous wishlist in place.

## What the reader does with each row

| MDBList row | Shared file item |
| --- | --- |
| `movies` | `mediaType: "movie"`. `tmdbId` from `ids.tmdb`, `imdbId` from `ids.imdb` or `imdb_id`, `year` from `release_year`, `sourceId` from `ids.mdblist`. |
| `shows` | `mediaType: "show"`. Same rules. When the row has no `ids` object (the schema's show shape), `tmdbId` stays empty; the generic `id` goes into `sourceId` as `mdblist-shows-<id>`, never into `tmdbId`. |
| `seasons`, `episodes` | `mediaType: "season"` or `"episode"` with `season` (0 to 10,000) and, for episodes, `episode` (1 to 10,000), from `season`/`season_number` and `episode`/`episode_number`. Title, year, `tmdbId` and `imdbId` name the **parent show** and come only from a nested `show` object or fields named for the show (`show_tmdb_id`, `show_imdb_id`). The row's own `ids` are never copied, because they may belong to the season or episode. Without proven parent IDs, the row has no catalog ID and no year, so GoodWatch leaves it unmatched. Missing coordinates make the row invalid but visible. The preview offers Want to See the show, unchecked, as #715 specifies. |
| Another list name | Kept as unsupported; the file's coverage becomes `unknown`. |
| The same row twice | Written once and counted as a repeat, only when the row has a native ID and every mapped field matches, including the `watchlist_at` date. |
| Same native ID, different fields | Both kept; counted as an identity conflict. |
| A row with no native ID | Always kept, even when another row has the same title and year. |

`addedAt` comes from `watchlist_at`, the per-row time the title was added (owner decision, October 23, 2026, after the real run). A value that isn't a valid timestamp is left out and counted as `watchlistAtUnreadable`. `added_at` is null on real rows and isn't used. The reader never writes `sourceSeen` or `sourceSeenAt`: the Watchlist route proves no watched flag. The report lists date-like field names (`addedLikeKeys`, including any name ending in `_at`).

## Completeness rules

- `complete`: the last page has no next cursor **and** says there are no more items (`X-Has-More: false` or a `has_more` field), any reported total matches, and the cross-check (when on) agrees.
- `unknown`: the last page has no cursor but says nothing about more items, MDBList sent a list or top-level field the reader doesn't know, a row isn't an object, `pagination` isn't an object, a count field isn't a number, or any page of any read (combined or cross-check) comes without `X-Total-Items` or `X-Matched-Items`.
- `partial`: any count field (any name containing "total" or "count") or `X-Total-Items` header on any page differs from the rows received, a page's `X-Matched-Items` differs from that page's rows, or the cross-check disagrees. Each cross-check read checks its own counts.
- No file: a `movies`, `shows`, `seasons`, or `episodes` entry that isn't a list, 401 (refused key), 403 (refused request), a daily-limit 429, a second 429 or a wait over 60 seconds, 5xx three times, network failure three times, a body that isn't JSON or has no movies or shows list, two different cursors, a repeated cursor, "more" without a cursor, or more than 1,000 pages.

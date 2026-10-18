# MDBList Watchlist reader (prototype, #711)

A local, read-only command that reads a member's MDBList personal Watchlist and writes a [shared wishlist file](../../../implementation/shared-wishlist-format.md) for the GoodWatch Imports page. It calls one route, `GET https://api.mdblist.com/watchlist/items`, with cursor pagination. It never calls a write route and needs no OAuth app.

Gates: [GATES.md](GATES.md), committed before the reader was written. Results: [VALIDATION.md](VALIDATION.md).

## Run the tests

You need Node.js 22.18 or later (Node 24 recommended). No `npm` install is needed.

```sh
node --test docs/prototypes/wishlist-imports/mdblist-reader/reader.test.mjs
```

The tests use a fake MDBList server (`fake-mdblist.mjs`) with the synthetic fixture (`fixtures/synthetic-watchlist.json`), and they parse each written file with the shipped `parseWishlistFile`.

## Read a real Watchlist

1. Save the personal API key outside Git:

   ```sh
   mkdir -p ~/goodwatch-private/711 && chmod 700 ~/goodwatch-private/711
   # Paste the key into this file, then:
   chmod 600 ~/goodwatch-private/711/mdblist-api-key
   ```

2. Run the reader. `--limit 2` forces pagination for the experiment; leave it out for normal use (100 per page). `--cross-check` reads each media type again to compare against the combined read.

   ```sh
   node docs/prototypes/wishlist-imports/mdblist-reader/reader.mjs --limit 2 --cross-check
   ```

3. The reader writes two files, both mode 600:

   - `~/goodwatch-private/711/mdblist-watchlist.json`: the wishlist file to upload on the Imports page. It holds titles and IDs, so it stays private.
   - `~/goodwatch-private/711/mdblist-shape-report.json`: field names, types, counts, cursor placement, request counts, and rate-limit headers. It holds no key, titles, IDs, or cursor values, so it's safe to share.

Exit code `0` means the file was written; the summary line says its coverage (`complete`, `partial`, or `unknown`). Exit code `2` means nothing was written and the previous wishlist file stays as it was.

Options: `--key-file`, `--out`, `--report`, `--limit 1..1000`, `--cross-check`. The `MDBLIST_API_KEY` environment variable overrides the key file. The reader refuses to write inside a Git work tree.

## What the reader does with each row

| MDBList row | Shared file item |
| --- | --- |
| `movies` | `mediaType: "movie"`. `tmdbId` from `ids.tmdb`, `imdbId` from `ids.imdb` or `imdb_id`, `year` from `release_year`, `sourceId` from `ids.mdblist`. |
| `shows` | `mediaType: "show"`. Same rules. When the row has no `ids` object (the schema's show shape), `tmdbId` stays empty; the generic `id` goes into `sourceId` as `mdblist-shows-<id>`, never into `tmdbId`. |
| `seasons`, `episodes` | Kept with `mediaType: "season"` or `"episode"`. The shipped parser shows them as entries it can't read, and they can't become wishes. |
| Another list name | Kept as unsupported; the file's coverage becomes `unknown`. |
| The same row twice | Written once; counted as a repeat in the report. |

The reader never writes `addedAt`. It reports field names that look like dates (`addedLikeKeys`) so a real sample can show whether MDBList sends one.

## Completeness rules

- `complete`: the last page has no next cursor **and** says there are no more items (`X-Has-More: false` or a `has_more` field), any reported total matches, and the cross-check (when on) agrees.
- `unknown`: the last page has no cursor but says nothing about more items, or MDBList sent a list the reader doesn't know.
- `partial`: a reported total or the cross-check disagrees.
- No file: 401 or 403, a daily-limit 429, a second 429 or a wait over 60 seconds, 5xx three times, network failure three times, a body that isn't JSON or has no movies or shows list, two different cursors, a repeated cursor, "more" without a cursor, or more than 1,000 pages.

# MDBList Watchlist reader: validation (#711)

Status on October 23, 2026: **synthetic fixture and one real account.** See [Real-account run](#real-account-run-october-23-2026). Gates are in [GATES.md](GATES.md), committed in `1d25a29b` before the reader existed.

## What was tested

- **Fixture:** 11 synthetic rows (7 movies, 2 shows, 1 season, 1 episode) using public catalog IDs. The fixture includes a movie with IDs, a show without an `ids` object, two works titled "Dune", the same Toy Story row twice, a rewatch candidate, a movie with no catalog ID, and a movie and a show that share TMDB ID 1399.
- **Server:** a fake `/watchlist/items` that follows the published schema's buckets. Cursor placement (`next_cursor` at top level or in `pagination`) and the "has more" signal (header or field) are switchable, because MDBList's real placement is unproven.
- **Parser:** every written file goes through the shipped `parseWishlistFile`.
- **Live API:** one request with an invalid key. MDBList answered HTTP 401 with JSON and no rate-limit headers; the reader exited `2`, wrote no file, and took 176 ms.
- **Schema:** `https://api.mdblist.com/schema/?format=json` re-downloaded on October 19, 2026. SHA-256 `12a16e8b…964f6e`, the same bytes the research inspected.

## Results against the gates (fixture)

36 of 36 tests pass (`node --test reader.test.mjs`, Node 24.15), against the shipped v1.1 parser from main `33bb75ca`. The first 25 came with `960d739c`. The review of that commit added 8 more, each written failing first and then fixed.

| Gate | Fixture result |
| --- | --- |
| G1 Accounted once | Pass. 11 rows received = 8 wishes + 2 unsupported + 1 repeat. A repeat needs a native ID and identical mapped fields. Rows without IDs, or with differing fields, are kept; differing ones count as identity conflicts. |
| G2 Exhaustion proven | Pass. `complete` only with an explicit end signal; without one, `unknown`. |
| G3 Counts agree | Pass. Every count field on every page is checked: any name with "total" or "count", numeric strings included. A total of 12 for 11 rows, `total_count: 9` for 1 row, or a wrong total on an earlier page makes the file `partial`. An unreadable count makes it `unknown`. The cross-check finds a row lost from the per-type read and makes the file `partial`. |
| G4 Failure is never success | Pass, 15 cases, including a malformed bucket (`shows` as an object): 401, 403 mid-way, wrong key, daily-limit 429, 429 twice, 429 with a 600 s wait, 5xx three times, network down, HTML body, unknown envelope, "more" without a cursor, repeated cursor, page cap, no key. The CLI leaves a previous file untouched, refuses a path inside Git also through a symlink, refuses equal wishlist, report, and key paths, and keeps the previous wishlist when the report can't be written. Unexplained fields or non-object rows give `unknown`. |
| G5 Native identity | Pass. The show without `ids` keeps only its IMDb ID; `id` goes to `sourceId`. TMDB 1399 stays one movie and one show. |
| G6 Unsupported visible | Pass. With v1.1, the season row with parent IDs becomes a show candidate; the episode row with only its own IDs stays unmatched; rows without coordinates stay `invalid`. None is promoted without the member choosing Want to See the show. |
| G7 Shipped parser accepts | Pass. No envelope error. The no-ID movie has a year, so the shared title-and-year rule decides it. |
| G8 No invented dates | Pass. No `addedAt`. `exportedAt` is the capture time. |
| G9 Budget | Pass on the fixture. 11 rows at `limit=2`: 6 requests; with cross-check: 13. A 1,000-title list at the default 100 per page: 10 requests (11 if the last page is full), 1% of the free daily 1,000. Cross-check roughly doubles it. |
| G10 Operational steps | Pass by design, not yet observed: copy key, save file, run one command, compare counts. Upload is optional. |

Not measured: real cursor placement, whether real show rows carry `ids`, whether any per-item added time exists, real rate-limit headers, real time per page.

## Limits and failure modes

- **Envelope unknown until a real run.** The reader recognizes top-level `next_cursor` and `pagination.next_cursor`/`nextCursor`/`cursor`. If MDBList puts the cursor elsewhere but sends `X-Has-More: true`, the reader fails safely with "more items but no cursor". It doesn't silently stop.
- **No end signal means `unknown`.** If MDBList never sends `X-Has-More` or a `has_more` field, every file says `unknown`, and the Imports page warns about partial coverage.
- **Show TMDB IDs.** The schema's example show `id` (258902, English Teacher) matches the TMDB ID GoodWatch uses for that show. That's one example, not a contract, so the reader doesn't use it. Shows without `ids.tmdb` match by IMDb ID, which most shows have. Owner decision, October 19, 2026: keep IMDb-only for shows without `ids.tmdb` unless the real sample proves the generic `id` is a TMDB ID.
- **Season and episode rows (addressed by [#715](https://github.com/alp82/goodwatch-monorepo/issues/715)).** The reader now writes format 1.1: season and episode rows carry coordinates, and the preview offers Want to See the show, confirmed by the member. Parent-show IDs come only from a nested `show` object or fields named for the show. The real season and episode shape is unproven, so with today's fixture assumptions a real row may arrive without parent IDs and stay unmatched. The report counts `parentShowIdsProven` and `parentShowIdsMissing`.
- **Rewatch.** MDBList has no rewatch flag. A watchlist title that's Seen in GoodWatch goes through the existing explicit rewatch choice. That flow isn't re-tested here.
- **The key is a full-access key.** MDBList personal keys aren't read-only. The reader only sends GET to one route, but nothing on MDBList's side enforces that.
- **The key travels in the URL** (`?apikey=`), the only documented key method. The reader never prints or stores the URL.
- **Quota is shared** with the member's other MDBList clients, so a member near the daily limit gets a clear "daily limit" failure, not a partial file.

## Real-account run, October 23, 2026

One consenting owner account, one free-tier key, reader at `adabe897`, run as `reader.mjs --limit 2 --cross-check`. Only aggregate counts and field names are recorded here; the wishlist file stays in `~/goodwatch-private/711/`.

**Reference:** the MDBList Watchlist page shows "Items: 8". The owner listed 8 titles from a screenshot.

| Measure | Result |
| --- | --- |
| Rows captured | 8 of 8 (3 movies, 5 shows). All 8 owner-listed titles, no others. The owner read the split as 4 and 4; MDBList files one of the titles as a show. |
| Coverage | `complete`. Last page had no cursor, `X-Has-More: false` and `pagination.has_more: false`. |
| Pages | 4 combined pages (2, 2, 2, 2 rows), 3 cursors followed. |
| Requests | 11 (4 combined + 2 movie + 3 show + 1 season + 1 episode cross-check reads), 0 retries, 851 ms. |
| Cross-check | 8 identities in both reads, 0 missing either way. Season and episode filters returned 0 rows. |
| Counts | `pagination.total` = 8 on every page (reader checked). `X-Total-Items` = 8, 3 and 5 for the combined, movie and show reads (checked by hand, not by the reader). `X-Matched-Items` is the row count of the current page. |
| Identity | Every movie **and** show row has an `ids` object with `ids.tmdb`; the schema's show example is out of date. `id` = `ids.tmdb` on 8 of 8. 7 rows have an IMDb ID; 1 show has only TMDB. |
| Shipped parser (v1.1, main) | 8 candidates, 0 problems, no coverage warning: 3 movies (TMDB+IMDb), 4 shows (TMDB+IMDb), 1 show (TMDB only). |
| Rate limit | `X-RateLimit-Limit: 1000`, 989 left after the run, reset at 00:00 UTC. |

**Response envelope:** top level `movies`, `shows`, `pagination`. `pagination` has `has_more`, `limit`, `offset`, `total` and, when more rows exist, `next_cursor`. Headers: `X-Has-More`, `X-Total-Items`, `X-Matched-Items`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

**Per-row fields beyond the schema:** `release_date` (day), `status`, `runtime`, `added_at` (null on 8 of 8), `watchlist_at` (millisecond UTC timestamp, present on 8 of 8, 8 distinct values, all in the past), `rating`, `rating_precise`, `last_watched_at` (null on 8 of 8), `total_aired_episodes` (null on 8 of 8).

**Gates on the real run:** G1, G2, G3, G5, G7 and G9 pass. G8 passes by rule (no `addedAt` written), but `watchlist_at` is a strong candidate for a source-added date. G6 was not observed: no season or episode on this Watchlist. G4 was observed live only for 401 (invalid key, October 19). G10: the owner saved the key; the run took one command.

**Watched title outside the Watchlist:** the owner's Breaking Bad season 1 is marked watched in MDBList and sits in Up Next, not on the Watchlist. The reader reads only `/watchlist/items`, so it doesn't see it, as intended: watch history isn't Want to See. `last_watched_at` is null on all 8 Watchlist rows, so no Watchlist row carries watched evidence in this sample.

**Other observation:** a request from Python's default HTTP client got HTTP 403 with a valid key; the same request with an explicit `User-Agent` returned 200. The reader (Node `fetch`) wasn't affected, but it reports any 403 as a refused key.

## Fixes from the real run, October 23, 2026

Owner decisions: map `watchlist_at` to `addedAt`; build fixes 1 to 4 test-first. 41 of 41 tests pass; each fix had a failing test first.

1. `watchlist_at` becomes `addedAt` when it's a valid timestamp; other values are left out and counted.
2. `X-Total-Items` is checked like `pagination.total` on every page, and each page's `X-Matched-Items` against that page's rows. Each cross-check read checks its own counts.
3. Requests send an explicit `User-Agent`. A 403 says "MDBList refused the request" with code `forbidden`; only 401 blames the key.
4. `addedLikeKeys` also lists names ending in `_at`.

Also: the Git work tree check now needs a real marker. An empty `.git` folder had appeared in `/tmp` on this machine and made the reader refuse to write there.

**Rerun on the real account:** 8 of 8, `complete`, 11 requests, 952 ms. `pagination.total`, `X-Total-Items` and `X-Matched-Items` all match. 8 of 8 rows have `addedAt`; the shipped parser reports 0 problems.

## Review fixes for a84c8971, October 23, 2026

Synthetic tests only; MDBList wasn't called. 45 of 45 tests pass; each fix had a failing test first. The fake server now sends both count headers by default, as the real Watchlist does.

- **P1:** a page without `X-Total-Items` or `X-Matched-Items`, in the combined read or a cross-check read, makes the coverage `unknown`. Tested with both headers missing, each one missing, one page missing, and one filtered read missing.
- **P2:** the mapped `watchlist_at` date is part of a row's identity. The same native IDs with and without a valid date are two rows and one identity conflict, not a repeat. Identical dated rows are still one repeat.
- **P3:** the report redacts any field name or text equal to or containing the API key, on success and on failure.

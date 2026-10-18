# MDBList Watchlist reader: validation (#711)

Status on October 19, 2026: **synthetic fixture only.** The real-account run waits on a personal API key from the owner. Gates are in [GATES.md](GATES.md), committed in `1d25a29b` before the reader existed.

## What was tested

- **Fixture:** 11 synthetic rows (7 movies, 2 shows, 1 season, 1 episode) using public catalog IDs. The fixture includes a movie with IDs, a show without an `ids` object, two works titled "Dune", the same Toy Story row twice, a rewatch candidate, a movie with no catalog ID, and a movie and a show that share TMDB ID 1399.
- **Server:** a fake `/watchlist/items` that follows the published schema's buckets. Cursor placement (`next_cursor` at top level or in `pagination`) and the "has more" signal (header or field) are switchable, because MDBList's real placement is unproven.
- **Parser:** every written file goes through the shipped `parseWishlistFile`.
- **Live API:** one request with an invalid key. MDBList answered HTTP 401 with JSON and no rate-limit headers; the reader exited `2`, wrote no file, and took 176 ms.
- **Schema:** `https://api.mdblist.com/schema/?format=json` re-downloaded on October 19, 2026. SHA-256 `12a16e8b…964f6e`, the same bytes the research inspected.

## Results against the gates (fixture)

25 of 25 tests pass (`node --test reader.test.mjs`, Node 24.15).

| Gate | Fixture result |
| --- | --- |
| G1 Accounted once | Pass. 11 rows received = 8 wishes + 2 unsupported + 1 repeat. |
| G2 Exhaustion proven | Pass. `complete` only with an explicit end signal; without one, `unknown`. |
| G3 Counts agree | Pass. A total of 12 for 11 rows makes the file `partial`. The cross-check finds a row lost from the per-type read and makes the file `partial`. |
| G4 Failure is never success | Pass, 14 cases: 401, 403 mid-way, wrong key, daily-limit 429, 429 twice, 429 with a 600 s wait, 5xx three times, network down, HTML body, unknown envelope, "more" without a cursor, repeated cursor, page cap, no key. The CLI leaves a previous file untouched and refuses a path inside Git. |
| G5 Native identity | Pass. The show without `ids` keeps only its IMDb ID; `id` goes to `sourceId`. TMDB 1399 stays one movie and one show. |
| G6 Unsupported visible | Pass. The season and episode rows reach the parser and come back `invalid`, with no wish snapshot. |
| G7 Shipped parser accepts | Pass. No envelope error. The no-ID movie has a year, so the shared title-and-year rule decides it. |
| G8 No invented dates | Pass. No `addedAt`. `exportedAt` is the capture time. |
| G9 Budget | Pass on the fixture. 11 rows at `limit=2`: 6 requests; with cross-check: 13. A 1,000-title list at the default 100 per page: 10 requests (11 if the last page is full), 1% of the free daily 1,000. Cross-check roughly doubles it. |
| G10 Operational steps | Pass by design, not yet observed: copy key, save file, run one command, upload one file. |

Not measured: real cursor placement, whether real show rows carry `ids`, whether any per-item added time exists, real rate-limit headers, real time per page.

## Limits and failure modes

- **Envelope unknown until a real run.** The reader recognizes top-level `next_cursor` and `pagination.next_cursor`/`nextCursor`/`cursor`. If MDBList puts the cursor elsewhere but sends `X-Has-More: true`, the reader fails safely with "more items but no cursor". It doesn't silently stop.
- **No end signal means `unknown`.** If MDBList never sends `X-Has-More` or a `has_more` field, every file says `unknown`, and the Imports page warns about partial coverage.
- **Show TMDB IDs.** The schema's example show `id` (258902, English Teacher) matches the TMDB ID GoodWatch uses for that show. That's one example, not a contract, so the reader doesn't use it. Shows without `ids.tmdb` match by IMDb ID, which most shows have.
- **Season and episode rows look broken.** Shared format v1 has no producer-declared "unsupported" outcome. These rows show as "GoodWatch couldn't read this entry", which is safe but unclear.
- **Rewatch.** MDBList has no rewatch flag. A watchlist title that's Seen in GoodWatch goes through the existing explicit rewatch choice. That flow isn't re-tested here.
- **The key is a full-access key.** MDBList personal keys aren't read-only. The reader only sends GET to one route, but nothing on MDBList's side enforces that.
- **The key travels in the URL** (`?apikey=`), the only documented key method. The reader never prints or stores the URL.
- **Quota is shared** with the member's other MDBList clients, so a member near the daily limit gets a clear "daily limit" failure, not a partial file.

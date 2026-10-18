# MDBList Watchlist reader: candidate gates

Ticket: [#711](https://github.com/alp82/goodwatch-monorepo/issues/711) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). These gates were written and committed before the reader existed and before any measurement. The owner accepts or changes them at the final comparison.

## Scope under test

- Route: `GET https://api.mdblist.com/watchlist/items` only. No `/lists/...`, dynamic, official, external, or shared lists. No write route, no OAuth app.
- Authentication: the member's personal API key, read from a file outside Git. The key never appears in output, logs, reports, or Git.
- Output: one shared wishlist file (`format: goodwatch-wishlist`, `version: 1`) plus one sanitized shape report with no titles, IDs, cursor values, or account details.

## Gates

Each gate is pass or fail per run. The real-account run counts only when it uses `limit=2`, so the list spans at least three pages.

| ID | Gate | Pass condition |
| --- | --- | --- |
| G1 | Accounted once | Every row the API returned is in exactly one bucket of the run summary: written as a wish, written as a visible unsupported row, or counted as an exact repeat of an earlier row. Written + unsupported + repeats = rows received. |
| G2 | Exhaustion proven | `completeness: "complete"` is written only when the final page carries no next cursor **and** an explicit "no more" signal (`X-Has-More: false` or an equivalent field). Any other ending writes `partial` or `unknown`, or fails. |
| G3 | Counts agree | When the API reports a total, it equals rows received. When the cross-check is on, the per-type reads (`mediatype=movie`, `show`, `season`, `episode`) return the same identity set as the combined read. A mismatch never yields `complete`. |
| G4 | Failure is never success | 401, 403, a daily-limit 429, a 429 that keeps failing after its allowed retry, 5xx after retries, non-JSON, an unrecognized envelope, a repeated cursor, `has more` without a cursor, or the page cap: the reader exits non-zero and writes no wishlist file. A previous file at the output path stays untouched. |
| G5 | Native identity | Movie and show rows keep TMDB and IMDb IDs only from fields that name them. The reader never copies the generic `id` into `tmdbId`. A same numeric TMDB ID on a movie and a show stays two identities. |
| G6 | Unsupported scope visible | Season and episode rows appear in the file with their own scope and are rejected as wishes by the shipped parser. They are never promoted to a show. |
| G7 | Shipped parser accepts | The written file parses with the shipped `parseWishlistFile` with no envelope error. Movies and shows with an ID become wish candidates; a row with no ID stays unmatched or title-and-year only, as the shared contract says. |
| G8 | No invented dates | `addedAt` is never written unless a response field proves a per-item source-added time. `exportedAt` is the capture time. |
| G9 | Budget | A complete read of a list of N rows at the default page size uses at most `ceil(N / 100) + 1` requests, plus at most 4 cross-check reads per extra page set. The run reports requests, retries, wall time, and the rate-limit headers seen. Against the shared free quota of 1,000 requests a day, a 1,000-title list costs about 11 requests (about 1%). |
| G10 | Operational steps | The member's setup, after having an MDBList account, takes at most four steps: copy the key, save it to one file, run one command, upload one file. |

## Required cases

The synthetic fixture covers every case. The real-account run covers each case the owner can seed. Cases the owner can't seed are reported as not observed, not as passed.

1. A movie with TMDB and IMDb IDs.
2. A show, with whatever ID shape the API actually returns.
3. A duplicate title: two different works with the same title, and the same work returned twice.
4. An explicit rewatch wish: a title the member already has as Seen in GoodWatch. MDBList has no rewatch flag, so the reader writes an ordinary wish. The shipped import already requires the explicit rewatch choice for Seen titles.
5. An unsupported season or episode entry, if MDBList lets the owner add one.
6. A row with a missing ID.
7. Pagination with `limit=2`, so the reader follows at least two cursors.
8. Failure paths: 401, 429 with `Retry-After`, daily-limit 429, missing cursor, repeated cursor, malformed body.

## What is not measured here

- Matching precision against the GoodWatch catalog. Native-ID matching is the shipped baseline.
- Any population claim. One consenting account is one account.
- Source-added dates, unless a response proves them (G8).

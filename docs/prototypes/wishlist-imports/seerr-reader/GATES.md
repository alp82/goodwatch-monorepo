# Seerr Watchlist reader: candidate gates

Ticket: [#712](https://github.com/alp82/goodwatch-monorepo/issues/712), map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). Written on 2026-10-19 **before** any measurement. The owner accepts or changes these gates at the final comparison. They are candidates, not release criteria.

## What is measured

- Seerr under test: the unmodified `ghcr.io/seerr-team/seerr:develop` image built from `63705622eac5dd4e1006775e9fc43215c3ea0c88` (the commit the research inspected), and release `v3.5.0` (`ghcr.io/seerr-team/seerr:latest`, `e2f24cb4`), which is what most self-hosters run.
- Every container runs on an internal Docker network with no internet access and no published host port. TMDB and the Plex discover endpoints are a local HTTPS mock. Local rows are added through Seerr's own `POST /api/v1/watchlist`, so Seerr's code writes them.
- The Plex mock follows the response shape Seerr's parser expects. It is not an observed Plex response. Real Plex behavior (page sizes, ETag scope, missing GUIDs) needs an owner token and stays unverified until then.
- The reader's output is checked with the shipped parser, `parseWishlistFile` in `goodwatch-webapp/app/server/imports/wishlist.server.ts`.

## Coverage labels the reader may emit

| Label | Only when |
| --- | --- |
| `complete` | Every page came from the local list, the row count equals `totalResults`, the number of unique `(tmdbId, mediaType)` pairs equals `totalResults`, and a second read of page 1 at the end returns the same `totalResults` and the same rows. |
| `unknown` | Any page came from the Plex fallback, any page shape is unrecognized, or the checks for `complete` fail in a way the reader can't explain. |
| `partial` | Not used by this reader. A count shortfall means rows are missing, but the reader can't tell which, so it reports `unknown` with the shortfall. |

When the read yields zero rows, the reader writes no file and exits with a distinct code. An empty Seerr answer can mean an empty list, an empty Plex list, or a failed Plex read. Seerr's response doesn't say which.

## Local list gates

Denominator: the seeded local rows per fixture user, unique by `(tmdbId, mediaType)`.

| ID | Gate | Pass |
| --- | --- | --- |
| L1 | Recall and contamination | For every fixture size (1, 20, 21, 41 and 60 rows), the output identity set equals the seeded set: 0 missing, 0 extra, 0 duplicates. |
| L2 | Namespace | The same numeric TMDB ID as a movie and as a show yields two items with the right `mediaType`. |
| L3 | Truthful label | 0 runs labelled `complete` when the output differs from the seeded set, across all scenarios in this file, including the trap scenarios. |
| L4 | Intent | 0 acquisition requests appear as wishes. A title that is both requested and on the Watchlist appears once. |
| L5 | Scope | 0 rows from another user. Reading another user's list without permission fails without writing a file. |
| L6 | Projection | Items carry only `title`, `mediaType`, `tmdbId` and, if chosen, `addedAt`. No email, username, user or record IDs, Plex token or `ratingKey`. The shipped parser accepts the file with 0 invalid rows. |
| L7 | Errors | Wrong key, wrong user, a stopped server, a non-JSON body and a malformed envelope each end with a nonzero exit and no file. |

## Plex fallback gates

These run against users with zero local rows.

| ID | Gate | Pass |
| --- | --- | --- |
| P1 | No Plex token | The reader writes no file, and it reports that Seerr has no local rows and no fallback. |
| P2 | Plex label | 100% of Plex-derived captures are labelled `unknown`, never `complete`. |
| P3 | Filtered rows | When the mock drops rows (no TMDB GUID, metadata 404), the reader reports the shortfall against `totalResults` in 100% of cases. It never invents the dropped rows. |
| P4 | Failure path | A failed Plex list read, an expired token and a metadata 500 never produce a file labelled `complete`. A failure on a later page is detected as a changed `totalResults`. |
| P5 | Repeated page | If Seerr serves a cached page again for a later page (ETag scope), the reader detects the duplicates. |
| P6 | Source switch | If the local list empties between pages, so later pages come from Plex, the reader doesn't label the file `complete`. |

## Route comparison (informational, no gate)

Source inspection shows `GET /api/v1/discover/watchlist` skips local rows whenever the user has a Plex token. The harness records what this route and the ticket's `GET /api/v1/user/:id/watchlist` return for the same user, so the owner can see which list a member sees in Seerr's UI.

## Operational measures

Requests per capture, wall time per capture, and the steps a member needs. These have no pass threshold yet. They are reported for the owner's comparison.

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
| `complete` | Every page came from the local list, the row count equals `totalResults`, the number of unique `(tmdbId, mediaType)` pairs equals `totalResults`, and a second read of page 1 at the end returns the same `totalResults` and the same rows. Superseded after review: see L8. |
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

## Gates added after the first review

An independent review of `66dac1a0` found false `complete` labels and unsafe token handling. These gates were added on 2026-10-19 with failing reproductions (`f4eb88bf`), before the fixes were measured. The `complete` rule changes from "a reread of page 1 matches" to "two full passes return the same identity sequence". Two agreeing passes are evidence that the list held still, not proof.

| ID | Gate | Pass |
| --- | --- | --- |
| L8 | Snapshot | A count-preserving edit during the read (delete row 21 and append row 61 after page 2 of 3) is never labelled `complete`. Rows from the second pass count toward the source check. |
| L9 | Envelope | A page number that differs from the requested page, a page count that doesn't match `ceil(totalResults / 20)`, or a page with the wrong number of rows is never labelled `complete`. |
| P7 | Plex type | 0 Plex-derived rows become movie wishes the import could apply without a member's choice. Seerr reports every non-show Plex type as `movie`. |
| S1 | Secret | Seerr never holds the owner's token. A delayed background-refresh failure with a synthetic token is injected; the synthetic token appears in Seerr's stderr (positive control) and in 0 kept files. In the owner check, Seerr logs with `--log-driver none` and the token appears in no container configuration, no file and no script output. |
| O1 | Cleanup | Errors, INT and TERM leave 0 owned containers, networks and tmpfs folders. |
| O2 | Networks | A same-named network without the `gw712` label, or with the wrong `Internal` setting, is refused before any container starts. |

## Gates added after the second review

A second review of `a27ae182` found five more problems. These gates were added on 2026-10-19 with failing reproductions (`ef8d0708`), before the fixes were measured.

| ID | Gate | Pass |
| --- | --- | --- |
| L9 (extended) | Envelope | Every page in both passes reports the same total and page count. Totals of 60, 59 and 60 are never labelled `complete`. |
| L10 | Rows without identity | Rows without a TMDB ID are never merged with each other. Three such rows produce three items. |
| S2 | Arguments | The owner's token is never a process argument or environment variable. A static check allows `$token` only in shell builtins, and a scan of every readable `/proc/*/cmdline` and `environ` runs during the dry run. |
| S3 | Echoes | When Plex bodies echo the token (literal, percent-encoded, base64 or JSON-escaped, in 200 and 401 bodies), the fetch recording holds no form of it. |
| S4 | Redirects | When Plex redirects to another host, the token is never sent there. |

## Route comparison (informational, no gate)

Source inspection shows `GET /api/v1/discover/watchlist` skips local rows whenever the user has a Plex token. The harness records what this route and the ticket's `GET /api/v1/user/:id/watchlist` return for the same user, so the owner can see which list a member sees in Seerr's UI.

## Operational measures

Requests per capture, wall time per capture, and the steps a member needs. These have no pass threshold yet. They are reported for the owner's comparison.

# Seerr Watchlist reader: measured results

Ticket: [#712](https://github.com/alp82/goodwatch-monorepo/issues/712). Measured on 2026-10-19, after the gates in [GATES.md](GATES.md) were committed (`c0b4fc82`). This is prototype evidence for the owner's verdict. It isn't a verdict or a support claim.

## What was tested

| Item | Detail |
| --- | --- |
| Seerr builds | `ghcr.io/seerr-team/seerr:develop` at `63705622` (the inspected commit) and `ghcr.io/seerr-team/seerr:latest`, release `v3.5.0` at `e2f24cb4`. Both images are unmodified. |
| Data | Synthetic only. 10 fixture members with local Watchlist rows, plus 10 members with zero local rows for the Plex cases. Local rows were added through Seerr's own `POST /api/v1/watchlist` and acquisition requests through `POST /api/v1/request`. Only two things bypass the API: the first administrator row and each fake Plex token, which go into the disposable SQLite database. |
| Network | Internal Docker network, no internet, no published host port. TMDB and the Plex discover endpoints are a local HTTPS mock ([mock-upstream.mjs](harness/mock-upstream.mjs)). |
| Plex | **Mock only.** The mock follows the response shape Seerr's parser expects. Real Plex behavior is the owner step in the [README](README.md#owner-step-real-plex-check). |
| Database backend | SQLite, Seerr's default. Postgres wasn't tested. |
| Output check | Every file was parsed with the shipped `parseWishlistFile` from `goodwatch-webapp/app/server/imports/wishlist.server.ts`. |
| Not tested | Real member data, real Plex, Jellyfin or Emby users, very large lists (above 60 local rows), and GoodWatch catalog matching. The output carries TMDB IDs, so matching uses the shipped explicit-ID path, which this ticket didn't re-benchmark. |

Raw results: [results/develop-63705622.json](results/develop-63705622.json) and [results/v3.5.0-e2f24cb4.json](results/v3.5.0-e2f24cb4.json). The two builds produced identical outcomes in all 27 scenarios, so each number in the following tables holds for both builds.

## Gate results

### Local list

| Gate | Result | Denominator |
| --- | --- | --- |
| L1 Recall and contamination | **Pass.** 143 of 143 seeded titles read, 0 extra, 0 duplicates. | Fixture lists of 1, 20, 21, 41 and 60 rows (1, 1, 2, 3 and 3 pages). The CLI reread the 21- and 60-row lists, also exactly. |
| L2 Namespace | **Pass.** 17 of 17 same-number pairs came out as one movie and one show each. | 34 rows that share a TMDB number across movie and TV. |
| L3 Truthful label | **Pass.** 0 false `complete` labels in 54 runs (27 scenarios on each of two builds). Every trap ended as `unknown` or no file. | All scenarios, including 5 trap scenarios: a title added during the read, a title removed during the read, rows in an unknown layout, a switch from local rows to Plex, and a repeated Plex page. |
| L4 Intent | **Pass.** 0 of 5 request-only titles became wishes. 2 of 2 titles that were both requested and on the Watchlist appear once. | 7 acquisition requests on the 60-row member. |
| L5 Scope | **Pass.** 0 of another member's 5 separate titles appeared. Reading another member's list with one's own sign-in got `403`: the reader exited 4 and wrote no file. | 1 other member with 8 rows, 3 of which overlap. |
| L6 Projection | **Pass.** Every item has only `title`, `mediaType`, `tmdbId` and `addedAt`. A text scan found no email, avatar, token, `ratingKey` or user record. The parser accepted every file with 0 invalid rows. A title with a line break and a tab was cleaned. A Unicode and emoji title survived. | 17 written files per build. |
| L7 Errors | **Pass.** A wrong API key, a wrong password, another member's ID and an unreachable host each exited 4 with no file. A malformed envelope (stub) was rejected. | 5 cases. |

Each raw local row carries the member's email, Plex ID, avatar URL, quotas and the full media record, because Seerr loads the user and media relations eagerly. Projecting fields on the member's machine before upload is necessary, not just tidy.

### Plex fallback (mock)

| Scenario | Seerr's answer | Reader result | Gate |
| --- | --- | --- | --- |
| No Plex token | 0 titles, `totalPages: 1` | No file. Reason: no local titles and no Plex account. | P1 pass |
| 25 titles, all with a TMDB GUID | 25 of 25 | `unknown`, 25 titles | P2 pass |
| 3 of 25 without a TMDB GUID | Total 25, 22 sent | `unknown`, 22 titles, shortfall of 3 reported | P3 pass |
| 3 of 25 metadata `404` | Total 25, 22 sent | `unknown`, 22 titles, shortfall of 3 reported | P3 pass |
| 1 of 11 metadata `500` | 0 titles, `totalPages: 0` | No file. Reason: Plex empty or failed, and Seerr doesn't say which. | P4 pass |
| Plex list `500` | 0 titles, `totalPages: 0` | Same as the previous row | P4 pass |
| Plex token expired (`401`) | 0 titles, `totalPages: 0` | Same as the previous row | P4 pass |
| 30 titles, page 2 fails | Page 1: total 30. Page 2: total 0. | `unknown`, 20 titles. Total change and shortfall reported. | P4 pass |
| 30 titles, one ETag for the whole list | Page 2 is page 1 again | `unknown`, 20 titles. 20 duplicates reported. | P5 pass |
| Empty Plex list | 0 titles, `totalPages: 0` | No file, same reason as a failed read | P1 pass |
| Local rows deleted after page 1, then Plex | Page 1 local, page 2 Plex | `unknown`. Mixed sources reported. | P6 pass |

All 11 Plex scenarios pass. Requests per capture: 1 for an empty Plex answer, and the number of pages plus 1 otherwise.

### Route comparison

For a member with 21 local titles and a Plex token (25 Plex titles), the two routes disagree:

| Route | Total | Rows from |
| --- | --- | --- |
| `GET /api/v1/user/:id/watchlist` (the reader's route) | 21 | Local list |
| `GET /api/v1/discover/watchlist` (Seerr's Watchlist slider) | 25 | Plex |

A Plex-linked member who adds titles in Seerr can see their Plex Watchlist in Seerr's UI while the reader exports their local list. The reader names its source in the report, but the member may not expect the difference.

### Operational measures

| Measure | Local list | Plex fallback (mock) |
| --- | --- | --- |
| Requests | 2 to 4 for 1 to 60 titles: pages plus one reread of page 1 | 1 to 3 |
| Reader time | 11 to 100 ms per capture inside the Docker network | 6 to 215 ms, which includes the harness's mid-read changes |
| Member steps | Run one command with Seerr's URL plus a sign-in. Local accounts can use email and password. Plex-only accounts need a session cookie or an admin's API key. | Same |

Two full reads of the 60-row list returned the same order on SQLite. Seerr's query has no `ORDER BY`, so the order depends on the database. The reader doesn't rely on order: the distinct-title count and the reread of page 1 catch skipped or repeated rows.

## Limits and failure modes

1. **An empty answer can't be explained.** An empty Plex list, an expired token, a failed Plex read and a single item's metadata error all look the same: `totalResults: 0, totalPages: 0`. The reader writes no file. It can say Seerr tried Plex, but not why nothing came back.
2. **One bad Plex item hides the whole page.** A metadata error other than `404` or a timeout makes Seerr drop every row it was going to send for that request. On page 1, this looks like an empty list.
3. **Seerr can repeat a page (mock).** Its Plex cache is keyed by token only and sends the cached ETag for every page. If Plex uses one ETag for the whole list, page 2 comes back as page 1. The reader detects it, but it can't recover the missing rows. Whether real Plex does this is unknown until the owner step.
4. **Source detection depends on row shape.** Local rows have `createdAt`, and Plex rows have exactly `id`, `ratingKey`, `title`, `mediaType` and `tmdbId`, with `id` equal to `tmdbId`. This holds in both tested builds, but it isn't a Seerr contract. An unknown shape falls back to `unknown`, so a future change makes the reader cautious, not wrong.
5. **`addedAt` is a Seerr record time.** Local rows are only created by the member's own "add to Watchlist", so `createdAt` is when they added it in Seerr. The reader keeps the UTC calendar day. That day can be one off from the member's local date.
6. **No year, no IMDb ID.** Seerr's Watchlist row has neither. The file relies on the TMDB ID.
7. **Sign-in is the hard part for members.** Plex-only Seerr accounts have no password, and a member of someone else's Seerr has no API key. Those members need a browser session cookie, which is awkward. A same-origin snippet run on the Seerr page would avoid that, but this ticket didn't build or test one.
8. **Postgres isn't tested.** Unordered paging may be less stable there. That would raise the share of `unknown` labels, but it can't produce a false `complete`, because the label requires every distinct identity to arrive.

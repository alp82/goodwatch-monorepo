# Seerr Watchlist reader: measured results

Ticket: [#712](https://github.com/alp82/goodwatch-monorepo/issues/712). First measured on 2026-10-19 after the gates in [GATES.md](GATES.md) were committed (`c0b4fc82`). Remeasured the same day after two independent reviews, of `66dac1a0` and `a27ae182`. Their findings became failing scenarios and tests first (`f4eb88bf` and `ef8d0708`), then fixes. This is prototype evidence for the owner's verdict. It isn't a verdict or a support claim.

## What was tested

| Item | Detail |
| --- | --- |
| Seerr builds | Pinned by digest: `develop` at `63705622` (the inspected commit) and release `v3.5.0` at `e2f24cb4`. Both images are unmodified. |
| Data | Synthetic only. 11 fixture members with local Watchlist rows, plus 12 members with zero local rows for the Plex cases. Local rows were added through Seerr's own `POST /api/v1/watchlist`, and acquisition requests through `POST /api/v1/request`. Only two things bypass the API: the first administrator row and each fake Plex token, which go into the disposable SQLite database on tmpfs. |
| Network | Internal Docker network, no internet, no published host port. TMDB and the Plex discover endpoints are a local HTTPS mock ([mock-upstream.mjs](harness/mock-upstream.mjs)). |
| Plex | **Mock only.** The mock follows the response shape Seerr's parser expects. Real Plex behavior is the owner step in the [README](README.md#owner-step-real-plex-check). |
| Database backend | SQLite, Seerr's default. Postgres wasn't tested. |
| Output check | Every file was parsed with the shipped `parseWishlistFile` from `goodwatch-webapp/app/server/imports/wishlist.server.ts`. |
| Not tested | Real member data, real Plex, Jellyfin or Emby users, very large lists (above 60 local rows), and GoodWatch catalog matching. Local files carry TMDB IDs, so matching uses the shipped explicit-ID path, which this ticket didn't re-benchmark. |

Raw results: [results/develop-63705622.json](results/develop-63705622.json) and [results/v3.5.0-e2f24cb4.json](results/v3.5.0-e2f24cb4.json). Both builds produced identical outcomes in all 35 scenarios, so each number in the following tables holds for both builds.

## How the review changed the reader

- **`complete` needs two identical passes.** The reader reads every page, then reads every page again. It labels a file `complete` only when both passes return the same identity sequence and every other check passes. The old rule, a reread of page 1, missed an edit that keeps the count. Seerr pages with `LIMIT` and `OFFSET` and no snapshot, so two agreeing passes are evidence that the list held still, not proof.
- **Envelopes are checked against Seerr's own total.** The returned page number must match the requested one. The page count must equal `ceil(totalResults / 20)`, and each page must hold the number of rows that the total implies. Every page in both passes must report the same total.
- **Rows without an identity stay separate.** Only rows with a TMDB ID, or a Plex `sourceId`, are deduplicated.
- **Plex movie rows become type `unknown`.** Seerr reports every Plex type that isn't `show` as `movie`, so a Plex row of another type could get a wrong identity. Plex movie rows now carry their TMDB number only as `sourceId` (`plex-guid-tmdb:<n>`), and the import blocks them until a member picks a match. Plex show rows keep their type and TMDB ID.
- **An unconfirmed capture merges both passes.** When the label is `unknown`, the file holds every title seen in either pass. A title removed during the read can reappear, and the member reviews the file before importing.

## Gate results

### Local list

| Gate | Result | Denominator |
| --- | --- | --- |
| L1 Recall and contamination | **Pass.** 143 of 143 seeded titles read, 0 extra, 0 duplicates. | Fixture lists of 1, 20, 21, 41 and 60 rows (1, 1, 2, 3 and 3 pages). The CLI reread the 21- and 60-row lists, also exactly. |
| L2 Namespace | **Pass.** 17 of 17 same-number pairs came out as one movie and one show each. | 34 rows that share a TMDB number across movie and TV. |
| L3 Truthful label | **Pass.** 0 false `complete` labels in 70 runs (35 scenarios on each of two builds). | All scenarios, including 11 trap and stub scenarios. |
| L4 Intent | **Pass.** 0 of 5 request-only titles became wishes. 2 of 2 titles that were both requested and on the Watchlist appear once. | 7 acquisition requests on the 60-row member. |
| L5 Scope | **Pass.** 0 of another member's 5 separate titles appeared. Reading another member's list with one's own sign-in got `403`: the reader exited 4 and wrote no file. | 1 other member with 8 rows, 3 of which overlap. |
| L6 Projection | **Pass.** Items carry only `title`, `mediaType`, `tmdbId`, `addedAt` and, for Plex movie rows, `sourceId`. A text scan found no email, avatar, token, `ratingKey` or user record. The parser accepted every file with 0 invalid rows. | 19 written files per build. |
| L7 Errors | **Pass.** A wrong API key, a wrong password, another member's ID and an unreachable host each exited 4 with no file. A malformed envelope (stub) was rejected. | 5 cases. |
| L8 Snapshot | **Pass.** The count-preserving edit (delete row 21, append row 61 after page 2) is `unknown`: "The two passes returned different titles or a different order." Before the fix it was a false `complete` that omitted row 41. A stub that returns Plex-shaped rows on the reread is `unknown` too. | 1 Seerr scenario and 1 stub. |
| L9 Envelope | **Pass.** `page: 999, totalPages: 0` with one row, a page 2 that answers as page 1, and page totals of 60, 59 and 60 are all `unknown`. All three were `complete` before their fixes. | 3 stubs. |
| L10 Rows without identity | **Pass.** Three rows without a TMDB ID produce three items, labelled `unknown`. Before the fix they collapsed into one. | 1 stub. |

Each raw local row carries the member's email, Plex ID, avatar URL, quotas and the full media record, because Seerr loads the user and media relations eagerly. Projecting fields on the member's machine before upload is necessary, not just tidy.

### Plex fallback (mock)

| Scenario | Seerr's answer | Reader result | Gate |
| --- | --- | --- | --- |
| No Plex token | 0 titles, `totalPages: 1` | No file. Reason: no local titles and no Plex account. | P1 pass |
| 25 titles, all with a TMDB GUID | 25 of 25 | `unknown`, 25 titles, 0 applicable movie wishes | P2, P7 pass |
| 3 of 25 without a TMDB GUID | Total 25, 22 sent | `unknown`, shortfall of 3 reported | P3 pass |
| 3 of 25 metadata `404` | Total 25, 22 sent | `unknown`, shortfall of 3 reported | P3 pass |
| 1 of 11 metadata `500` | 0 titles, `totalPages: 0` | No file. Reason: Plex empty or failed, and Seerr doesn't say which. | P4 pass |
| Plex list `500` | 0 titles, `totalPages: 0` | Same as the previous row | P4 pass |
| Plex token expired (`401`) | 0 titles, `totalPages: 0` | Same as the previous row | P4 pass |
| 30 titles, page 2 fails | Page 1: total 30. Page 2: total 0. | `unknown`. Shortfall reported. | P4 pass |
| 30 titles, one ETag for the whole list | Page 2 is page 1 again | `unknown`. 20 duplicates reported. | P5 pass |
| Empty Plex list | 0 titles, `totalPages: 0` | No file, same reason as a failed read | P1 pass |
| 3 movies and 2 episodes | 5 rows, all marked `movie` | `unknown`, 0 applicable movie wishes | P7 pass |
| Local rows deleted after page 1, then Plex | Page 1 local, page 2 Plex | `unknown`. Mixed sources reported. Movie wishes come only from the 21 local rows. | P6, P7 pass |
| Background refresh fails (synthetic token) | Cached rows. Seerr stays up. | `unknown` | S1, see the next section |

### Token handling

Seerr's rolling cache refreshes Plex metadata in the background once a cached entry is more than 10 seconds old, with no rejection handler (`server/api/externalapi.ts`). In the harness, the mock fails that refresh 10 times. Seerr stays up, but its stderr then held the synthetic token 60 times (positive control) and 0 kept files held it. Both builds behave this way. Seerr's own logs on a member's server would hold that member's Plex token in the same way. That's an upstream issue, not something the reader causes.

The owner check therefore never gives Seerr the owner's token:

1. The script reads the token with a hidden prompt, or one line from stdin. It never takes a token file.
2. A fetch container gets the token on stdin and makes the Plex `GET` requests Seerr would make, in Seerr's order and with Seerr's ETag rule. It removes the token from the recorded responses and writes them to a pipe.
3. A replay container reads the pipe and plays Plex for a fresh Seerr from memory. Seerr runs on an internal network, has only a synthetic token, logs with `--log-driver none`, and keeps its data on tmpfs.
4. Only a counts summary is written to disk. Before keeping it, the script checks it for the token with `secret-scan.py`, which reads the token on stdin. The token is never a process argument: the script uses it only in the shell builtins `read`, `printf` and `unset`.

The fetch container's recording keeps only the fields Seerr reads: list totals and rating keys, and each item's rating key, type, title and GUIDs. Bodies of non-2xx answers are dropped. Requests refuse redirects, so the token can't follow one to another host. As a last check, the fetch step refuses to send a recording that still holds the token in literal, percent-encoded, base64 or JSON-escaped form.

[tests/fetch-test.sh](harness/tests/fetch-test.sh) checks this against the mock. Plex bodies echo a synthetic token with `+/=&?#%` in it (so every encoding differs) in all four forms, in 200 list, 200 metadata and 401 metadata bodies. The recording held 0 forms of it, against 27 before the fix. A list redirect to another host received the token 0 times, against 4 before the fix.

The dry-run test ([tests/owner-check-test.sh](harness/tests/owner-check-test.sh)) injects the delayed refresh failure in the same flow. It confirms:

- 50 failures were served, and Seerr presented 1 token, the synthetic one.
- The owner token never appeared in a container configuration, a file or the script output, checked every second during the run.
- The owner script passes the static check: it uses `$token` only in builtins. A tight scan of every readable `/proc/*/cmdline` and `environ` ran for the whole dry run (about 2,800 sweeps) and found 0 hits. That scan alone is a weak test: it also found 0 hits before the fix, because the old `grep` lived for only a moment. The static check is what failed before the fix.
- Seerr's log driver was `none`.
- Only the summary remained, and it holds no token, title or Plex key.
- The tmpfs folder and all containers were gone afterwards.

In the dry run, the replay matched every request Seerr made: 0 list misses and 0 metadata misses.

### Scripts

| Gate | Result |
| --- | --- |
| O1 Cleanup | **Pass.** An image that doesn't exist, INT and TERM on `run.sh`, and INT on the owner check each left 0 containers, networks and work files ([tests/cleanup-test.sh](harness/tests/cleanup-test.sh)). Before the fix, each `run.sh` case left the Seerr and mock containers running. |
| O2 Networks | **Pass.** An unlabeled `gw712-net`, a labeled but not internal `gw712-net`, and an unlabeled `gw712-owner-replay` were refused before any container started ([tests/network-test.sh](harness/tests/network-test.sh)). Before the fix, `run.sh` started containers on both foreign networks. |
| Image pins | Seerr and Node images are pinned by digest in [lib.sh](harness/lib.sh). The owner check uses `v3.5.0`. |

### Route comparison

For a member with 21 local titles and a Plex token (25 Plex titles), the two routes disagree:

| Route | Total | Rows from |
| --- | --- | --- |
| `GET /api/v1/user/:id/watchlist` (the reader's route) | 21 | Local list |
| `GET /api/v1/discover/watchlist` (Seerr's Watchlist slider) | 25 | Plex |

A Plex-linked member who adds titles in Seerr can see their Plex Watchlist in Seerr's UI while the reader exports their local list.

### Operational measures

| Measure | Local list | Plex fallback (mock) |
| --- | --- | --- |
| Requests | 2 to 6 for 1 to 60 titles: every page twice | 2 to 4 |
| Reader time | 11 to 104 ms per capture inside the Docker network | Under 90 ms |
| Member steps | Run one command with Seerr's URL plus a sign-in. Local accounts can use email and password. Plex-only accounts need a session cookie or an admin's API key. | Same |

## Limits and failure modes

1. **Two passes are evidence, not proof.** An edit undone before the second pass reaches the same page could go unnoticed. Seerr offers no snapshot or version to check against.
2. **Some empty answers can't be explained.** An empty Plex list, an expired token, a failed Plex read and one item's metadata error all return the same thing: 0 results, 0 pages. The reader can only say "Seerr tried Plex".
3. **One bad Plex item hides the whole page.** A single metadata error other than `404` or a timeout makes Seerr send nothing for that request.
4. **Seerr can repeat a page (mock).** Its Plex cache sends the same ETag for every page. If Plex uses one ETag for the whole list, page 2 comes back as page 1. The reader detects this but can't recover the missing rows.
5. **Plex movies need a member's choice.** Seerr hides the Plex type, so every Plex row that isn't a show is imported as type `unknown`. The owner's real-Plex check counts how many Plex types other than movie and show actually occur.
6. **Source detection relies on row shape, which isn't a Seerr contract.** An unknown shape falls back to `unknown`.
7. **`addedAt` is the UTC date the local Seerr record was created.** Only the member's own "add to Watchlist" creates local rows, and merges keep the timestamp. It isn't a Plex add date, and it can be one day off from the member's local date.
8. **No year, no IMDb ID.** Seerr's Watchlist row has neither.
9. **Sign-in is the weakest member step.** Plex-only Seerr accounts have no password, so those members need a browser session cookie or an admin's API key.
10. **Postgres isn't tested.** Unordered paging may be less stable there, which would raise the share of `unknown` labels. Agreeing passes remain evidence, not proof, there too.
11. **The replay isn't live Plex.** It reproduces Plex's recorded answers, including ETags and `304` responses, but not timing, rate limits or network failures during Seerr's own reads.

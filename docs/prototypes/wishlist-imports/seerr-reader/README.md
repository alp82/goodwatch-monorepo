# Seerr Watchlist reader (prototype for #712)

Throwaway prototype for [Can a Seerr Watchlist reader label its coverage truthfully?](https://github.com/alp82/goodwatch-monorepo/issues/712) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). It reads one Seerr member's Watchlist through `GET /api/v1/user/:id/watchlist` and writes a [shared wishlist file](../../../implementation/shared-wishlist-format.md) with source `seerr`.

- [GATES.md](GATES.md): candidate gates, committed before measuring.
- [RESULTS.md](RESULTS.md): measured results, limits and failure modes.
- [reader.mjs](reader.mjs): the reader. Node 22 or later, no dependencies.
- [harness/](harness/): disposable Seerr, mock TMDB and Plex, scenarios and the owner's Plex check.

## How the reader labels coverage

Seerr returns the local Watchlist when it has rows. With zero local rows, it asks Plex instead, and the response doesn't say which one answered. The reader tells them apart by row shape:

- **`complete`:** the reader read every page twice. Every page came from the local list, the page numbers and counts match Seerr's total, every title is distinct, and both passes returned the same titles in the same order. Seerr has no snapshot, so two agreeing passes are evidence that the list held still, not proof.
- **`unknown`:** anything from Plex, any unrecognized row layout, or any count, page, duplicate or change-during-read problem. The file holds every title seen in either pass, and the report lists the reasons.
- **No file (exit code 3):** Seerr returned nothing. The report says whether Seerr tried Plex.

Items carry only `title`, `mediaType`, `tmdbId` and, for local rows, `addedAt`: the UTC date the local Seerr record was created. Seerr reports every Plex type that isn't a show as a movie, so Plex movie rows are written as type `unknown`, with the TMDB number only in `sourceId` (`plex-guid-tmdb:<n>`). The import then waits for the member to pick a match. Seerr's rows also embed the member's email and other account fields. The reader drops those before writing.

## Run the reader

```sh
# A local Seerr account, reading your own list:
SEERR_EMAIL=you@example.org SEERR_PASSWORD='…' \
  node docs/prototypes/wishlist-imports/seerr-reader/reader.mjs --url http://your-seerr:5055 --out seerr-wishlist.json

# An admin's API key, reading member 7:
SEERR_API_KEY='…' node docs/prototypes/wishlist-imports/seerr-reader/reader.mjs --url http://your-seerr:5055 --user-id 7 --out seerr-wishlist.json

# A browser session cookie (for Plex-only accounts):
SEERR_COOKIE='connect.sid=…' node docs/prototypes/wishlist-imports/seerr-reader/reader.mjs --url http://your-seerr:5055 --out seerr-wishlist.json
```

The reader only sends `GET` requests, plus a `POST` to `/api/v1/auth/local` when you sign in with email and password. It prints a JSON report (counts and reasons, no titles) and writes the file only on success. Exit codes: `0` file written, `2` usage, `3` nothing to import, `4` error.

## Run the harness

Requires Docker, `openssl`, `sqlite3` and `python3` on the host. It pulls `ghcr.io/seerr-team/seerr` and `node:24-bookworm-slim`.

```sh
docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh develop   # the inspected commit 63705622
docs/prototypes/wishlist-imports/seerr-reader/harness/run.sh latest    # release v3.5.0
```

Each run takes about 45 seconds. It creates a fresh Seerr on an internal Docker network with no internet access and no published port, seeds it through Seerr's API, runs 35 scenarios and exits nonzero if any scenario fails. Images are pinned by digest in `harness/lib.sh`. Seerr's data lives on tmpfs under `/dev/shm`. Results land in `../seerr-712-validation/work/out-<tag>/` next to the repository (override with `GW712_WORK`), never in Git.

Every container and network carries the labels `gw712=1` and `gw712.run=<run>`. On every exit (success, error, Ctrl-C or TERM), the scripts remove what carries their run's label and their tmpfs folder. They refuse to use a same-named network that lacks the `gw712` label or has the wrong `Internal` setting.

The script tests need the same tools, and no `gw712` containers may be running before you start them:

```sh
docs/prototypes/wishlist-imports/seerr-reader/harness/tests/owner-check-test.sh   # token handling, about 1 minute
docs/prototypes/wishlist-imports/seerr-reader/harness/tests/fetch-test.sh         # echoed tokens and redirects, under 1 minute
docs/prototypes/wishlist-imports/seerr-reader/harness/tests/cleanup-test.sh       # error, INT and TERM cleanup, about 3 minutes
docs/prototypes/wishlist-imports/seerr-reader/harness/tests/network-test.sh       # network ownership, about 1 minute
```

## Owner step: real Plex check

The mock shows what Seerr does with each Plex answer. Only a real token shows what Plex actually sends. Run this only after the second independent review passes.

1. Make sure your Plex Watchlist has at least 21 titles, so it spans two pages.
2. Get your Plex token. Plex explains how in [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).
3. Run `docs/prototypes/wishlist-imports/seerr-reader/harness/owner-plex-check.sh` and paste the token at the hidden prompt. Don't save it in a file.
4. Share `~/goodwatch-private/712/plex-check.json`. It holds counts only: no titles, IDs or token.

What the script does:

- A fetch container gets your token on stdin and reads your Plex Watchlist with `GET` requests, in the order Seerr would make them. It refuses redirects, keeps only the response fields Seerr reads, and drops error bodies. It refuses to continue if any form of your token is left.
- The script never passes your token as a command argument. It uses the token only in shell builtins, and `harness/secret-scan.py` checks the summary by reading the token on stdin.
- The responses go through a pipe to a replay container, which plays Plex for a fresh, pinned Seerr (`v3.5.0`) from memory. Seerr gets a synthetic token, never yours, runs without internet access, logs to nowhere and keeps its data on tmpfs. This matters because Seerr can print a Plex token on stderr when a background refresh fails.
- The script removes every container and the tmpfs folder on every exit, including errors and Ctrl-C.
- It writes nothing to Plex or to any existing Seerr.

`--dry-run` uses the local mock instead of Plex and injects that background-refresh failure. `harness/tests/owner-check-test.sh` runs it and checks that the token never appears in a container, a file or the output.

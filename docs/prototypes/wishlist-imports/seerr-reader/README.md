# Seerr Watchlist reader (prototype for #712)

Throwaway prototype for [Can a Seerr Watchlist reader label its coverage truthfully?](https://github.com/alp82/goodwatch-monorepo/issues/712) on map [#702](https://github.com/alp82/goodwatch-monorepo/issues/702). It reads one Seerr member's Watchlist through `GET /api/v1/user/:id/watchlist` and writes a [shared wishlist file](../../../implementation/shared-wishlist-format.md) with source `seerr`.

- [GATES.md](GATES.md): candidate gates, committed before measuring.
- [RESULTS.md](RESULTS.md): measured results, limits and failure modes.
- [reader.mjs](reader.mjs): the reader. Node 22 or later, no dependencies.
- [harness/](harness/): disposable Seerr, mock TMDB and Plex, scenarios and the owner's Plex check.

## How the reader labels coverage

Seerr returns the local Watchlist when it has rows. With zero local rows, it asks Plex instead, and the response doesn't say which one answered. The reader tells them apart by row shape:

- **`complete`:** every page came from the local list, the counts match Seerr's total, every title is distinct, and a second read of page 1 at the end matches the first.
- **`unknown`:** anything from Plex, any unrecognized row layout, or any count, duplicate or change-during-read problem. The report lists the reasons.
- **No file (exit code 3):** Seerr returned nothing. The report says whether Seerr tried Plex.

Items carry only `title`, `mediaType`, `tmdbId` and, for local rows, `addedAt` (the UTC day the member added the title in Seerr). Seerr's rows also embed the member's email and other account fields. The reader drops those before writing.

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

Each run takes about 25 seconds. It creates a fresh Seerr on an internal Docker network with no internet access and no published port, seeds it through Seerr's API, runs 27 scenarios and removes its containers. Scratch data goes to `../seerr-712-validation/work/` next to the repository (override with `GW712_WORK`), never into Git. Results land in `work/out-<tag>/results.json`. Containers and the network carry the label `gw712=1`, and the scripts never remove anything without it.

## Owner step: real Plex check

The mock shows what Seerr does with each Plex answer. Only a real token shows what Plex actually sends. To measure it:

1. Get your Plex token. Plex explains how in [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).
2. Save it as one line in `~/goodwatch-private/712/plex-token`.
3. Make sure your Plex Watchlist has at least 21 titles, so it spans two pages.
4. Run `docs/prototypes/wishlist-imports/seerr-reader/harness/owner-plex-check.sh`.
5. Share `~/goodwatch-private/712/plex-check.json`. It holds counts only: no titles, IDs or token.

The script starts a fresh Seerr `latest` with no Plex server configured and no published port. It gives one new Seerr user your token and reads that user's Watchlist with the reader. It also reads your Plex Watchlist directly with `GET` requests. Then it removes the token and deletes the container and its data. It writes nothing to Plex or to any existing Seerr. Add `--dry-run` to try it against the mock first.

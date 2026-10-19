# Review page for the #709 private packet

A local page for reviewing the 77 historical Netflix match suggestions in
`~/goodwatch-private/709/review.json`, one key per row. It changes only each
entry's `review` and optional `notes` fields, so `../private-review.mjs aggregate`
keeps working.

## Start

```sh
node docs/prototypes/provider-id-gates/review-page/server.mjs
```

The server prints a URL like `http://127.0.0.1:<port>/?t=<token>`. Open that
URL. The port is a free one assigned by the OS, and the server listens on
`127.0.0.1` only. To review a different file, pass its path as the first
argument. Stop the server with Ctrl+C.

## Keys

| Key | Action |
| --- | --- |
| `c` `w` `a` `?` | Correct, wrong, ambiguous, or unknown, then go to the next row |
| `n` | No proposal, confirmed manual or absent (rows without a proposal only) |
| `-` | Clear the review |
| `j` `k`, arrow keys | Move between rows |
| `o`, `1`, `2` | Open both links, the Netflix page, or the TMDB page in new tabs |
| `u` | Show only unreviewed rows |
| `e` | Edit the row's note. Enter saves, Escape cancels |

When every row is reviewed, the page shows the exact aggregate command.

## Data handling

- Every change re-reads the packet, updates one entry, and replaces the file
  atomically (temporary file, then rename) with mode `0600`.
- On first start, the server copies the untouched packet to `review.json.orig`
  next to it. Later starts never overwrite that backup.
- The server refuses a packet inside a Git working tree.
- Posters and TMDB details come from the TMDB API at runtime, using
  `TMDB_API_KEY` from the environment or `goodwatch-webapp/.env`. Nothing is
  stored. Without a key, the page works without posters.
- Requests need the per-run token and the exact `127.0.0.1:<port>` host.

## Test with synthetic data

```sh
node docs/prototypes/provider-id-gates/review-page/make-synthetic.mjs
node docs/prototypes/provider-id-gates/review-page/server.mjs ~/.cache/gw709-review-page/synthetic/review.json
```

The synthetic packet uses public titles and made-up Netflix IDs. It includes
the traps the page flags: a year mismatch, a different original title, and a
show proposed as a movie.

# JustWatch Watchlist round trip (#708 prototype)

Throwaway prototype for [#708](https://github.com/alp82/goodwatch-monorepo/issues/708) on [map #702](https://github.com/alp82/goodwatch-monorepo/issues/702). It follows the route chosen in [#704](https://github.com/alp82/goodwatch-monorepo/issues/704#issuecomment-6255538043): read the signed-in member's explicit JustWatch **Watchlist** in their own browser, keep native identities and cursor evidence, and write [shared wishlist JSON v1](../../../docs/implementation/shared-wishlist-format.md) directly. Simkl's file dialect stays deferred. Don't merge this folder.

The candidate gates were committed before the first measurement: [GATES.md](GATES.md).

## Files

| File | Purpose |
| --- | --- |
| `capture-core.js` | Pager with explicit stop reasons, two-run reconciliation, conversion to the shared file, loss ledger and private evidence record. Plain JavaScript, used by both the snippet and the harness. Written independently from the observed protocol; no third-party code is copied. |
| `browser-runner.js` | The browser part of the snippet: reads the sign-in from the JustWatch tab, reads Watchlist twice and Seen list once, and downloads one file. |
| `build-snippet.mjs` | Builds `snippet/justwatch-capture.snippet.js` from the two files above. |
| `snippet-smoke.mjs` | Runs the built snippet in Node with browser stubs. Checks network destinations, cookies, session values in the file, and the `objectId` fallback. |
| `fixture.js`, `fake-justwatch.js` | Synthetic account and a fake `titleListV2` endpoint with offset cursors and injectable faults. |
| `preview-runner.ts` | Runs the real `parseWishlistFile` and `previewImport` against the in-memory import journal. Catalog reads go to an in-memory table or, on request, to production Crate read-only. |
| `synthetic.ts` | The synthetic round trip. Writes `results/synthetic-report.md` and `results/synthetic-results.json`. |
| `snippet-harness.mjs` | Browser stubs shared by the smoke test and the adversarial tests. |
| `report-core.ts`, `real-report.ts` | Aggregates-only report for the owner's real capture file, and its command-line wrapper. |
| `adversarial.test.ts` | The independent review's adversarial cases (see "Review fixes"). |

## Run

From `goodwatch-webapp` after `npm ci`:

```sh
node prototypes/justwatch-wishlist/synthetic.ts
node prototypes/justwatch-wishlist/build-snippet.mjs
node prototypes/justwatch-wishlist/snippet-smoke.mjs
node --test prototypes/justwatch-wishlist/adversarial.test.ts
# After the owner saves a real capture:
node prototypes/justwatch-wishlist/real-report.ts ~/goodwatch-private/708/justwatch-708-capture.json \
  --reference=<count the Watchlist page shows> \
  --catalog=crate --env=<main checkout>/goodwatch-webapp/.env
```

`real-report.ts` writes `real-report.md` next to the capture, outside Git. Only aggregates are printed.

## Synthetic results

Fixture: 47 Watchlist titles (33 movies, 13 shows, 1 season object), 4 negative controls (Seen-only movie, tracked-only unstarted show, finished show, liked-only movie), 20-item pages, a GoodWatch library with one Seen movie, one Watching show and one existing wish. Thirteen scenarios: one clean and twelve faults. Each scenario reads the Watchlist twice, as the snippet does. Full tables: [results/synthetic-report.md](results/synthetic-report.md).

| Gate | Result | Denominator |
| --- | --- | --- |
| C1 No contamination | Pass. 0 negative controls in any file. The leaked Seen-only node was excluded because it had no Watchlist entry. | 13 scenarios |
| C2 Recall on a clean run | Pass. 47 of 47. | 47 reference wishes |
| C3 No false complete | Pass for the file: 0 of 12 fault scenarios claim `complete`. **A single run fails** 1 of 12: an addition plus a removal during the run keeps `totalCount` stable and loses one wish while claiming `complete`. The second run catches it. | 12 fault scenarios |
| C4 Stop reason recorded | Pass. Every capture has a stop reason, pages, totals, duplicates and errors. | 13 scenarios |
| V1 Scope | Pass. 0 type errors; the season object became `unknown` and stayed unmatched. | 47 wishes, clean run |
| V2 No guessed IDs | Pass. 0 file IDs differ from what the fake provider returned. The `objectId` that equals another film's TMDB ID was never used. One malformed TMDB ID was dropped and counted. | 47 wishes, clean run |
| V3 Native identity | Pass. Every wish has its `sourceId`. Both "The Office" shows, both "Dune" films and the "Fargo" movie and show stayed separate and matched correctly. A native ID repeated across pages became one wish. | 47 wishes, clean run |
| V4 Loss is explicit | Pass. 11 loss-ledger fields with counts; see the following table. | |
| V5 Valid file | Pass. 2 rows are `invalid`, both deliberate (no content, control character in a title). | 47 rows |
| P1 Accounted for | Pass. Every wish has exactly one preview row. | 47 wishes, every scenario |
| P2 Correct match from good IDs | 40 correct, 0 wrong, 1 abstained (a localized title with no IDs). | 41 wishes with a known catalog title and honest IDs |
| P3 Wrong provider IDs | **Finding.** A provider TMDB ID that contradicts its IMDb ID is trusted. The wish matched the wrong film, then the preview hid it as "Listed twice in the file. Added once." because the correct film was also wished. The harness flagged it; the preview didn't. | 1 planted case |
| P4 Library semantics | Pass. Seen in GoodWatch → rewatch conflict; Watching show → status kept; existing wish → unchanged. | 3 planted cases |
| P5 Partial stays additive | Pass. 12 of 12 non-complete previews show the partial warning; 0 library writes. | 12 scenarios |

Loss ledger for the clean run:

| Source field | Count | What happens |
| --- | ---: | --- |
| `objectId` | 47 | Not carried; `sourceId` holds the native node ID. |
| `content.title` (localized) | 47 | Titles are in the capture language. Without IDs, the exact title-and-year fallback fails for a localized title. |
| `seenlistEntry` | 2 | A wish that is also Seen on JustWatch stays a plain wish. GoodWatch asks about rewatch only when GoodWatch itself has it Seen. |
| `tvShowTrackingEntry`, `seenState.progress` | 1 each | Tracking and progress are not carried; the wish is kept. |
| `externalIds` absent | 4 TMDB, 5 IMDb | Left absent, never looked up. |
| `externalIds.tmdbId` malformed | 1 | Dropped, not repaired. |
| `objectType` `SHOW_SEASON` | 1 | Kept as `unknown`. |
| `watchlistEntryV2.createdAt` absent | 1 | Left absent; export time is never substituted. |
| Unreadable title | 2 | Row kept and marked invalid. |

The snippet smoke test passed in both modes. It sent 7 requests (8 with the fallback), all `POST` to `https://apis.justwatch.com/graphql` with `credentials: "omit"`. The token, login ID and device ID never appear in the file.

The real-file report was also run against the synthetic capture with the production catalog, read-only: 18 allowlisted SELECTs (16 from the preview, 2 from the report's own TMDB-IMDb conflict check), 0 writes, about 8.7 seconds. An earlier version reported 16 because the conflict check bypassed the counter.

## Review fixes

An independent review of `0c2ae215` found six problems. Each one got a failing case in `adversarial.test.ts` (commit `1552cf6d`) before its fix.

1. **Server text in the download.** Raw GraphQL error messages, codes and paths were saved; an error that echoed a bearer token put the token in the file. Errors are now saved only as a category (`auth`, `rate-limit`, `validation`, `internal`, `other`) with a count. Cursors are no longer saved. Native IDs, object types, external IDs and paths are kept only when they match a strict shape. The report prints categories only.
2. **Empty file marked complete.** A `totalCount` of 1 with a null node, or with a node that has no Watchlist entry, gave zero wishes and `complete`. Entries without a readable native ID, and returned entries without Watchlist membership, now make the file `unknown` or `partial`.
3. **Missing `hasNextPage`.** An absent, null or non-boolean value counted as the end of the list. Only a literal `false` ends a run as `exhausted`; anything else stops with `invalid-page-info`.
4. **Wrong run in the report.** Identity and membership checks always used run 1, even when the file came from run 2. They now use the run the file was built from. Seen overlap is reported as "at least" when the Seen capture is incomplete.
5. **Uncounted catalog reads.** The report now counts every statement at the catalog boundary.
6. **Owner steps.** The owner step now asks for the unfiltered count and for which test cases the account already has.

## Limits

- **No real account yet.** Everything above is synthetic. Field availability (`objectId`, `externalIds`, `watchlistEntryV2`), cursor behavior, page size and rate limits on a real account are unverified.
- **Snapshot.** The API has no snapshot guarantee. Two agreeing runs are evidence, not proof. Edits between runs make the file `unknown`, which is safe but noisy.
- **Wrong provider IDs pass silently** in the shipped preview (P3). This is a preview gap, not an exporter gap. It affects any source that supplies both IDs.
- **Seen on JustWatch only** becomes a plain Want to See. The shared format has no field for source-side seen evidence.
- **Localized titles** weaken the title-and-year fallback when IDs are missing.
- **Session expiry** stops the run as `partial`; the snippet doesn't renew the session. A large list may need a page reload and a second try.
- **Country.** The snippet reads the country from the page path. One file holds one country's view; availability-only differences between countries are not tested.
- **Terms.** JustWatch's GraphQL endpoint is not a published third-party contract. This prototype makes read-only calls with the member's own session only.

## Owner step (about 3 minutes)

Use your account as it is. Don't add, remove or mark any titles for this experiment. A case your account doesn't already have stays untested.

1. In the browser where you're signed in to JustWatch, open your Watchlist page, for example `https://www.justwatch.com/de/watchlist`. Don't add or remove titles until step 5 finishes.
2. Clear every display filter on that page (services, genres, type, price), turn **Hide seen** off, and note the number of titles the page shows. That number is the unfiltered reference count.
3. Note yes or no for each of these, from what your account already has:
   - The Watchlist has movies.
   - The Watchlist has shows.
   - The Watchlist has more than 20 titles.
   - A title is on the Seen list but not on the Watchlist.
   - A show is tracked (started or followed) but not on the Watchlist.
   - A title is both on the Watchlist and on the Seen list.
4. Copy the snippet: `wl-copy < ~/goodwatch-private/708/justwatch-capture.snippet.js`. Its SHA-256 is printed by `build-snippet.mjs`.
5. Open the developer console (F12, then **Console**). If the browser asks, type `allow pasting` and press Enter. Paste and press Enter. Wait for `[GoodWatch] Saved justwatch-708-capture.json`. A long Seen list can take a few minutes.
6. Move the file: `mv ~/Downloads/justwatch-708-capture.json ~/goodwatch-private/708/`.

The file holds your Watchlist titles and JustWatch IDs, and the IDs of your Seen list without titles. It holds no token, cookie, login ID or device ID, and no server error text. Keep it outside Git.

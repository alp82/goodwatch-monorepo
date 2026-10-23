# Plex library watches and personal ratings (#760)

The existing Plex sign-in now reads library watched state and personal ratings as well as retained history. No additional member steps, permissions or database schema are needed. Only owned servers and the existing server-specific token are used; the public HTTPS, identity check, credential disposal and network restrictions remain in place.

## Documented source contract

The [official Plex Media Server API](https://developer.plex.tv/pms/) documents `GET /library/all`, media-query type numbers and comma-separated alternatives. GoodWatch reads movies and episodes with `type=1,4&includeGuids=1&sort=addedAt:asc`, then reads show and season ratings separately with `type=2,3&includeGuids=1&sort=addedAt:asc`. Each scan uses Plex container pagination headers and the response body’s `totalSize`; no total-size response header is assumed. Each stops at its first total, accepts growth beyond that snapshot, and rejects shrinking, duplicate, incomplete or oversized pages. Each scan is bounded to 50,000 source items, so shows and seasons do not consume the movie/episode scan limit. Both share the remaining space in the 50,000 resulting-observation limit. Network, payload, pagination and size failures discard only the failed scan’s library observations, preserve retained history and the other scan’s results, and show an actionable partial-import warning naming the omitted data. An overflowing library scan cannot cause retained history to be discarded. The overall five-minute deadline and retained-history limits still apply; this is not a promise that every import can complete regardless of size or duration.

The official `metadata` schema defines `userRating` as a personal number from 0 to 10, `viewCount` as consumption count and `lastViewedAt` as the last consumption timestamp in epoch seconds. Public `rating`, `audienceRating` and provider `Rating` arrays are not personal scores. Library `addedAt` and `updatedAt` do not date ratings or watches. The schema has no rating-date field; imported scores stay undated. Plex also [documents manually marking items watched](https://support.plex.tv/articles/201018487-mark-as-watched-or-unwatched/), independently of playing them.

| Plex evidence | GoodWatch mapping |
| --- | --- |
| Retained movie/episode history | One watch per history record, with its recorded `viewedAt` |
| Movie/episode `viewCount > 0`, without a usable retained history record for that library item | One watch; `lastViewedAt` when valid, otherwise undated; no synthetic repeats from the count |
| Movie `userRating` | Movie score; positive scores round to the nearest whole number, halves up, minimum 1: 7.5 → 8; 0 is unrated and skipped |
| Show `userRating` | Whole-show score with the same rounding; no episodes or completion inferred |
| Season/episode `userRating` | Unsupported observation, preserving the original decimal score and source scope pending #759 |
| Delivered Watchlist RSS items | Want to See through the existing feed path |

Absent, null or numeric-zero personal ratings are unset. A zero rating never writes a score or makes a title Seen; an independent watch can still make it Seen. Out-of-range or nonnumeric ratings remain invalid rows. An invalid supplied watch date produces an explanation and an undated watch. Episode GUIDs and parent-show identities use the shared conservative episode resolver; Plex coordinates never stand in for TMDB numbering. Local library show/season counts do not establish whole-catalog completion: a Plex library may contain only part of a show. Resolved episode watches update normal GoodWatch progress and can reach Seen when all aired regular catalog episodes are watched. A movie library watch makes the movie Seen.

## Watchlist RSS completeness finding

[Plex’s official Watchlist documentation](https://support.plex.tv/articles/universal-watchlist/) describes generating a personal RSS URL with Plex Pass. It does not promise complete historical Watchlist coverage or document a pagination contract for that feed. Therefore complete account coverage cannot be established from this documented interface. GoodWatch reads every delivered entry, keeps the existing explicit incomplete-coverage warning, and does not invent continuation query parameters or call undocumented Discover/community endpoints. A 120-item synthetic RSS test verifies that GoodWatch itself imposes neither a 25-item nor a 50-item cutoff. No live member feed was inspected, so this work does not claim a current Plex-side numeric cap.

## Preview, Confirm and Undo

The existing Imports page offers Ratings and Watches with its normal conflict and source-date choices. Unsupported season and episode scores show their coordinates and source score. Preview changes no member data. Confirm uses the existing score and tracking writers; repeat imports with the same Plex item identities are idempotent. A deleted and re-added item can receive a new Plex library identity and import as two watches; deduplication across those different identities is not guaranteed. Undo restores prior scores and removes its watches, preserving later edits. Plex now uses the existing guarded intention-restoration journal after score settlement, so pre-existing Want to See and Not interested can be restored with their original timestamps when no newer watch or choice remains. Existing Watcharr restoration retains the same behavior.

Synthetic fixtures run through a real local fake HTTP Plex server, including owner-token routing, library pagination, history overlap, scores, episodes, malformed data and independent failures. The service test exercises the real preview/Confirm/receipt/reimport/Undo paths with database fakes. It also checks that newer member choices and watches survive Undo, zero ratings cannot create Seen, and retained history remains confirmable and undoable after a partial library failure. Pagination regressions cover independent watch/rating limits, 50,000 retained plays, body-only totals and partial warnings.

The screenshots use the actual preview components and styles with the service test’s synthetic preview, not member exports: [Desktop](plex-library-preview-desktop.png), [Mobile](plex-library-preview-mobile.png). Browser checks exercise date selection, expanded rows and Confirm options, and check page errors and mobile overflow. To regenerate the synthetic preview data, run from `goodwatch-webapp`:

```sh
PLEX_PREVIEW_OUTPUT=/tmp/gw760-preview.json node --test app/server/imports/plex-library-service.server.test.ts
```

## Verification

The imports, IMDb-import and Imports UI suites pass: **625 tests**, no failures. Webapp typecheck reports **210 diagnostics**, identical to the unchanged-branch baseline after normalizing line positions; none added or removed. Browser verification passed at 1280 px and 390 px with no page errors or horizontal overflow. Live Plex accounts and production CrateDB writes were not exercised; all source data is synthetic.

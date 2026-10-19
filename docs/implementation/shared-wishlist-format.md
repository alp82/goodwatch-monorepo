# Shared wishlist interchange, version 1

This is a producer contract for additive wishlist intake. It is not a request for members to convert their exports. The Imports page accepts the original Watcharr JSON export through an adapter, as well as this shared format. Browser capture remains experimental; see [capture validation](../research/wishlist-exploration/capture-validation.md).

```json
{
  "format": "goodwatch-wishlist",
  "version": 1,
  "source": "example-service",
  "profileLabel": "Example profile",
  "country": "DE",
  "exportedAt": "2026-10-18T12:00:00Z",
  "completeness": "partial",
  "items": [
    {
      "title": "Toy Story",
      "mediaType": "movie",
      "year": 1995,
      "tmdbId": 862,
      "imdbId": "tt0114709",
      "sourceId": "provider-item-42",
      "sourceUrl": "https://example.org/title/provider-item-42",
      "addedAt": "2026-09-12"
    }
  ]
}
```

The envelope requires `format`, `version`, `source`, `completeness`, and `items`. `profileLabel`, `country`, and `exportedAt` are optional. Capture one profile and one wishlist per file. A producer must not combine a favorites list, recommendations, watch history, or several profiles into wishes. Additional uploaded fields are ignored, not stored. In particular, producers cannot supply `wishlistOriginal`, `wishlistResolution`, `wishlistParent`, or `problem` to authorize a match or change an import outcome.

Each item requires a nonempty `title` and `mediaType` (`movie`, `show`, or `unknown`). Other item fields are optional. `tmdbId` must be a positive safe integer; `imdbId` is `tt` followed by 7–10 decimal digits. Native provider IDs belong only in `sourceId`; they are never assumed to be TMDB IDs. Do not put a guessed catalog match in either catalog ID field. Leave unknown type as `unknown`, even if one media type seems more likely.

`year` is an integer from 1800 through 9999. Dates are a valid ISO calendar day or a timestamp with seconds and an explicit `Z` or numeric time zone. A capture time is `exportedAt`, not `addedAt`. Omit unknown source-added dates. Country, when present, is a two-letter uppercase code. Titles allow up to 1,000 characters, source/profile labels 200, native IDs/URLs 2,048. Control characters are rejected.

`completeness` is `complete`, `partial`, or `unknown`. Stopping after a fixed number of scrolls, or observing no new cards for a while, does not prove completeness. The parser preserves this evidence and warns for partial or unknown coverage. An empty file never deletes existing wishes. The maximum upload is 20 MiB and 50,000 entries, including unsupported or invalid rows.

The intake does not fetch `sourceUrl`. Only HTTP(S) URLs without embedded user information are accepted; query strings and fragments are removed before storing evidence. Producers must omit cookies, credentials, raw response payloads, and signed links. Source/profile/title strings are data, never executable markup.

## Matching and confirmation

Automatic matching uses the declared movie/show type, then TMDB, IMDb, or an exact unique title and year in the GoodWatch catalog. When supplied TMDB and IMDb IDs resolve to different canonical titles in that typed namespace, the row stays unmatched for an explicit member choice before duplicate suppression. Both candidates remain available; the row cannot add a wish until resolved. Unknown media type stays unmatched, even with a supplied catalog ID, until the member explicitly selects a local catalog movie or show. Title-only search results are candidates, never automatic matches. A malformed item stays visible as invalid; a malformed envelope or unsupported version rejects the upload.

Upload creates a preview. Confirmation adds only the selected wishes, never watches, ratings, episode progress, or new viewing activity. Existing wishes are kept; missing source items never remove existing ones. Seen titles require the explicit rewatch choice. Show tracking states remain authoritative. The ordinary import receipt and Undo boundaries apply.

Source evidence is stored in `ImportObservation.wishlistEvidence` separately from the effective GoodWatch identity. Its fields are `source`, optional `profileLabel`, `country`, `exportedAt`, `sourceId`, sanitized `sourceUrl`, original `mediaType`, and `completeness`. An unresolved unknown-type row uses a movie storage placeholder and remains blocked as unmatched. Consumers must not treat that placeholder as a match.

For validated source wishes, the server also stores an immutable normalized `wishlistOriginal` before matching. It preserves the source title, year, media type, supplied IDs, optional added date, evidence, and parser-level problem. A member selection never rewrites this snapshot or upgrades a chosen catalog ID into provider evidence. Historical previews without the snapshot require reupload for manual matching; the server does not reconstruct erased source fields.

Manual matching accepts a bounded delta of `{index,target:{mediaType,tmdbId}|null}` choices for originally valid unknown-type wishes or server-detected ID disagreements. The server verifies selected canonical IDs in the corresponding local catalog table, records authoritative title/year and selection provenance in server-owned `wishlistResolution`, and creates a fresh child preview. `wishlistParent` identifies its immediate source preview and row. Untouched choices survive; `null` restores the source observation. The parent remains independently confirmable, and choosing a match does not add a wish before Confirm.

A choice applies consistently to originally valid unknown rows sharing the same source, profile label, and native `sourceId` within the file. Conflicting choices for that group reject; rows without native IDs are not grouped by title. Effective canonical duplicates are suppressed in source order before library-conflict classification, while their original snapshots remain available for later changes. An explicit selection matches only its chosen typed canonical ID; it never falls back to source IMDb or title/year if that target disappears. Invalid and unsupported source entries cannot be made applicable by a member choice.

## Native adapter: Watcharr

The adapter reads the original array returned by Watcharr's export. Only `status: "PLANNED"` entries with movie or TV content are candidates. `content.type: "tv"` maps to `show`; `content.tmdbId` is required. Other statuses, games, and unsupported scopes remain reviewable without becoming wishes. The adapter does not derive added dates from record creation timestamps or activity.

Compatibility evidence includes source inspection, synthetic parser and service tests, and the unmodified pinned Watcharr backend running locally with synthetic accounts. Its authenticated export route returned the native array, rejected unauthenticated access, and kept accounts isolated. The resulting JSON is preserved as a regression fixture. No real member Watcharr export, rendered export dialog, or authenticated streaming-service capture has been validated. The original inspected source and commit are recorded in [tracker routes](../research/wishlist-exploration/tracker-routes.md).

## ID disagreements and suggested defaults (#714)

The items and matching-group APIs expose `wishlistIdConflict` on an unresolved disagreement: `candidates` holds each supplied-ID basis (`tmdb` or `imdb`), typed canonical ID, catalog title and year. `suggestion` is either null or a typed target with `signal`: `interaction`, `metadata`, or `popularity`. It is a suggested default for review, never a `wishlistResolution` or permission to apply. `wishlistMatchRequired: "id_conflict"` preserves manual-matching eligibility after a choice, so Change and Clear use the same path as unknown-type wishes. These are server-owned fields; uploaded extra fields remain ignored.

Signals are considered in this order:

1. Exactly one candidate has an existing member interaction: Want to See, a watch (Seen), a non-null rating, or a show status other than Not started. Different interaction kinds are not ranked or counted against each other. Lookups use the member and typed identity; another member's data and the other media namespace cannot choose the default.
2. Exactly one candidate matches the source title after trimming and case folding, and matches its year when supplied. Both candidates already belong to the declared media type. For example, a Dune (1984) row favours that movie over Dune (2021); P3's Inception (2010) favours Inception over The Matrix.
3. Both catalog popularity values are finite and positive, and one is at least twice the other. For example, 80 versus 20 suggests the former; 30 versus 25, equal values, and missing/zero values leave no suggestion. This conservative threshold is a heuristic, not a measured precision claim.

A tie at one level proceeds to the next; if no level distinguishes a candidate, nothing is suggested. A choice creates a child preview with the same immutable original observation and provider evidence. Clear restores the conflicting source IDs and recalculates the hold. Ordinary canonical duplicate suppression runs only after an explicit choice, as before.

Member-facing copy added for UX review: “The supplied TMDB and IMDb IDs identify different titles. Choose a match.” No import review UI components changed; presentation and preselection of the suggested default belong to the separate UX thread.

Validation for #714 (2026-10-19): the P3 synthetic regression first failed as an unsupported duplicate of The Matrix, then passed as an unmatched Inception hold. The imports server, legacy IMDb imports, and imports UI suites pass all 341 tests with fixture/mock catalog access. `npm run typecheck` exits 2 with 185 diagnostics; an isolated unchanged `a3954d76` worktree using the same installed dependencies produces the identical 185 diagnostic lines, with no added or removed errors. No live catalog/database was accessed. Independent review, UX integration, merge, and release verification remain pending; this change does not close #714.

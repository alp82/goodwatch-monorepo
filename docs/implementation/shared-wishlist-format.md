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

The envelope requires `format`, `version`, `source`, `completeness`, and `items`. `profileLabel`, `country`, and `exportedAt` are optional. Capture one profile and one wishlist per file. A producer must not combine a favorites list, recommendations, watch history, or several profiles into wishes. Additional fields are ignored, not stored.

Each item requires a nonempty `title` and `mediaType` (`movie`, `show`, or `unknown`). Other item fields are optional. `tmdbId` must be a positive safe integer; `imdbId` is `tt` followed by 7–10 decimal digits. Native provider IDs belong only in `sourceId`; they are never assumed to be TMDB IDs. Do not put a guessed catalog match in either catalog ID field. Leave unknown type as `unknown`, even if one media type seems more likely.

`year` is an integer from 1800 through 9999. Dates are a valid ISO calendar day or a timestamp with seconds and an explicit `Z` or numeric time zone. A capture time is `exportedAt`, not `addedAt`. Omit unknown source-added dates. Country, when present, is a two-letter uppercase code. Titles allow up to 1,000 characters, source/profile labels 200, native IDs/URLs 2,048. Control characters are rejected.

`completeness` is `complete`, `partial`, or `unknown`. Stopping after a fixed number of scrolls, or observing no new cards for a while, does not prove completeness. The parser preserves this evidence and warns for partial or unknown coverage. An empty file never deletes existing wishes. The maximum upload is 20 MiB and 50,000 entries, including unsupported or invalid rows.

The intake does not fetch `sourceUrl`. Only HTTP(S) URLs without embedded user information are accepted; query strings and fragments are removed before storing evidence. Producers must omit cookies, credentials, raw response payloads, and signed links. Source/profile/title strings are data, never executable markup.

## Matching and confirmation

Matching uses the declared movie/show type, then TMDB, IMDb, or an exact unique title and year in the GoodWatch catalog. Unknown media type stays unmatched even with a catalog ID. Title-only guesses do not apply. A malformed item stays visible as invalid; a malformed envelope or unsupported version rejects the upload.

Upload creates a preview. Confirmation adds only the selected wishes, never watches, ratings, episode progress, or new viewing activity. Existing wishes are kept; missing source items never remove existing ones. Seen titles require the explicit rewatch choice. Show tracking states remain authoritative. The ordinary import receipt and Undo boundaries apply.

Source evidence is stored in `ImportObservation.wishlistEvidence` separately from the matched GoodWatch identity. Its fields are `source`, optional `profileLabel`, `country`, `exportedAt`, `sourceId`, sanitized `sourceUrl`, original `mediaType`, and `completeness`. The current storage model uses a movie placeholder for unknown scope; the row is blocked as unmatched and the original scope remains in evidence. Consumers must not treat that placeholder as a match.

## Native adapter: Watcharr

The adapter reads the original array returned by Watcharr's export. Only `status: "PLANNED"` entries with movie or TV content are candidates. `content.type: "tv"` maps to `show`; `content.tmdbId` is required. Other statuses, games, and unsupported scopes remain reviewable without becoming wishes. The adapter does not derive added dates from record creation timestamps or activity.

Compatibility evidence includes source inspection, synthetic parser and service tests, and the unmodified pinned Watcharr backend running locally with synthetic accounts. Its authenticated export route returned the native array, rejected unauthenticated access, and kept accounts isolated. The resulting JSON is preserved as a regression fixture. No real member Watcharr export, rendered export dialog, or authenticated streaming-service capture has been validated. The original inspected source and commit are recorded in [tracker routes](../research/wishlist-exploration/tracker-routes.md).

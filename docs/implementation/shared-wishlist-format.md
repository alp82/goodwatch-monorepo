# Shared wishlist interchange, versions 1 and 1.1

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

Automatic matching uses the declared movie/show type, then TMDB, IMDb, or an exact unique title and year in the GoodWatch catalog. When supplied TMDB and IMDb IDs resolve to different canonical titles in that typed namespace, the row stays unmatched for an explicit member choice before duplicate suppression. The TMDB candidate and every distinct canonical IMDb candidate in that namespace remain available; the row cannot add a wish until resolved. An IMDb hit in the other media namespace is not a conflict. If the IMDb ID resolves to nothing in the declared namespace, the TMDB match is kept. Unknown media type stays unmatched, even with a supplied catalog ID, until the member explicitly selects a local catalog movie or show. Title-only search results are candidates, never automatic matches. A malformed item stays visible as invalid; a malformed envelope or unsupported version rejects the upload.

Upload creates a preview. Confirmation adds only the selected wishes, never watches, ratings, episode progress, or new viewing activity. Existing wishes are kept; missing source items never remove existing ones. Seen titles require the explicit rewatch choice. Show tracking states remain authoritative. The ordinary import receipt and Undo boundaries apply.

Source evidence is stored in `ImportObservation.wishlistEvidence` separately from the effective GoodWatch identity. Its fields are `source`, optional `profileLabel`, `country`, `exportedAt`, `sourceId`, sanitized `sourceUrl`, original `mediaType`, and `completeness`. An unresolved unknown-type row uses a movie storage placeholder and remains blocked as unmatched. Consumers must not treat that placeholder as a match.

For validated source wishes, the server also stores an immutable normalized `wishlistOriginal` before matching. It preserves the source title, year, media type, supplied IDs, optional added date, evidence, and parser-level problem. A member selection never rewrites this snapshot or upgrades a chosen catalog ID into provider evidence. Historical previews without the snapshot require reupload for manual matching; the server does not reconstruct erased source fields.

Manual matching accepts a bounded delta of `{index,target:{mediaType,tmdbId}|null}` choices for originally valid unknown-type wishes or server-detected ID disagreements. The server verifies selected canonical IDs in the corresponding local catalog table, records authoritative title/year and selection provenance in server-owned `wishlistResolution`, and creates a fresh child preview. `wishlistParent` identifies its immediate source preview and row. Untouched choices survive; `null` restores the source observation. The parent remains independently confirmable, and choosing a match does not add a wish before Confirm.

A choice applies consistently to manually matchable rows (unknown type or ID disagreement) sharing the same source, profile label, and native `sourceId` within the file. An agreeing row with the same native source ID is outside that manual-choice group: choosing a different title for a conflicting row can leave two wishes, one from each row. Conflicting choices for that group reject; rows without native IDs are not grouped by title. Effective canonical duplicates are suppressed in source order before library-conflict classification, while their original snapshots remain available for later changes. An explicit selection matches only its chosen typed canonical ID; it never falls back to source IMDb or title/year if that target disappears. Invalid and unsupported source entries cannot be made applicable by a member choice.

## Native adapter: Watcharr

The adapter reads the original array returned by Watcharr's export. Only `status: "PLANNED"` entries with movie or TV content are candidates. `content.type: "tv"` maps to `show`; `content.tmdbId` is required. Other statuses, games, and unsupported scopes remain reviewable without becoming wishes. The adapter does not derive added dates from record creation timestamps or activity.

Compatibility evidence includes source inspection, synthetic parser and service tests, and the unmodified pinned Watcharr backend running locally with synthetic accounts. Its authenticated export route returned the native array, rejected unauthenticated access, and kept accounts isolated. The resulting JSON is preserved as a regression fixture. No real member Watcharr export, rendered export dialog, or authenticated streaming-service capture has been validated. The original inspected source and commit are recorded in [tracker routes](../research/wishlist-exploration/tracker-routes.md).

## ID disagreements and suggested defaults (#714)

The items and matching-group APIs expose `wishlistIdConflict` on an unresolved disagreement: `candidates` holds each supplied-ID basis (`tmdb` or `imdb`), typed canonical ID, catalog title and year. `suggestion` is either null or a typed target with `signal`: `interaction`, `metadata`, or `popularity`. It is a suggested default for review, never a `wishlistResolution` or permission to apply. `wishlistMatchRequired: "id_conflict"` preserves manual-matching eligibility after a choice, so Change and Clear use the same path as unknown-type wishes. These are server-owned fields; uploaded extra fields remain ignored.

Signals are considered in this order:

1. Exactly one candidate has an existing member interaction: Want to See, a watch (Seen), a non-null rating, or a show status other than Not started, including Dropped. Dropped identifies a show the member knows; using it as an identity signal does not change that status or authorize adding a wish. Different interaction kinds are not ranked or counted against each other. Lookups use the member and typed identity; another member's data and the other media namespace cannot choose the default.
2. Exactly one candidate matches the source title after trimming and case folding, and matches its year when supplied. All candidates already belong to the declared media type. For example, a Dune (1984) row favours that movie over Dune (2021); P3's Inception (2010) favours Inception over The Matrix.
3. Every candidate has a finite, positive catalog popularity value, and the highest is at least twice the next highest. For example, 80 versus 20 suggests the former; 30 versus 25, equal values, and missing/zero values leave no suggestion. This conservative threshold is a heuristic, not a measured precision claim.

A tie at one level proceeds to the next; if no level distinguishes a candidate, nothing is suggested. A choice creates a child preview with the same immutable original observation and provider evidence. Clear restores the conflicting source IDs and recalculates the hold. Ordinary canonical duplicate suppression runs only after an explicit choice, as before.

Member-facing copy added for UX review: “The supplied TMDB and IMDb IDs identify different titles. Choose a match.” The match panel shows the existing “Type unknown” label only for unknown source types. Presentation and preselection of the suggested default belong to the separate UX thread.


## Version 1.1: source Seen and season/episode wishes (#715)

Use numeric `version: 1.1` (not a string) for the additional fields below. Version 1 continues to parse identically: its extra source-Seen and coordinate fields are ignored, and season/episode types remain invalid. All existing movie/show/unknown rows also work in 1.1, with no new required fields. See the complete [synthetic example file](shared-wishlist-v1.1.example.json).

| Item field | Contract |
| --- | --- |
| `sourceSeen` | Optional boolean. `true` is explicit source-side Seen evidence; `false` does not override GoodWatch Seen or other rows' positive evidence. Omit when unknown. |
| `sourceSeenAt` | Optional date in the same day/timestamp syntax as `addedAt`, allowed only with `sourceSeen: true`. Omit an unknown date; never substitute capture time, a tracking-start date, or partial episode progress. |
| `mediaType` | Also accepts `season` and `episode`. The title, year, TMDB ID and IMDb ID identify the **parent show**, never the season or episode. `sourceId` still identifies the original source row. |
| `season` | Required on season/episode rows, a nonnegative safe integer. Zero preserves a source special's coordinates without making it regular progress. Omitted on movie/show/unknown rows. |
| `episode` | Required on episode rows, a positive safe integer. Omitted on every other row type. |

A season or episode row is still a source wishlist entry. A Seen-list-only row is not a wish: a producer may attach source Seen evidence only to a row with independently established wishlist membership. For JustWatch, explicit Seen-list evidence can populate `sourceSeen` and a known Seen date can populate `sourceSeenAt`; `seenState.progress > 0` alone does not establish whole-show Seen. For MDBList, retain `mediaType: "season" | "episode"`, copy its known `season`/`episode` numbers, and supply independently established parent-show IDs. Do not copy a season/episode catalog ID into the parent-show ID fields. Neither prototype branch is changed by this contract.

Malformed flags, impossible dates, missing/invalid coordinates and coordinates attached to the wrong v1.1 row type make that row invalid. Valid source-Seen fields live in `wishlistEvidence` and its immutable `wishlistOriginal.wishlistEvidence` copy. Original media type and coordinates remain in `wishlistOriginal`; effective identity uses `show` for season/episode wishes. Coordinates are source evidence, not permission to resolve or import episode progress. Stable source keys distinguish seasons and episodes but do not depend on Seen flags or dates.

After matching and the #714 disagreement hold, canonical duplicates collapse to one show choice regardless of row order, including duplicates between whole-show, season and episode rows. Every original row remains stored. Positive source-Seen evidence and the requirement for a whole-show choice combine across those duplicates without rewriting any original evidence. An unresolved ID disagreement remains held independently until the member chooses a match; a season/episode can only resolve to a show. Rebuilding or clearing another match retains the original show namespace and all original coordinates.

The preview leaves **Want to See the show** unchecked. Confirmation must explicitly include `wishlistShows: true` to convert season/episode wishes into whole-show wishes. Source-Seen and GoodWatch-Seen titles additionally require the existing `conflictChoice: "source"` rewatch opt-in; neither choice supplies the other. Existing wishes remain unchanged. Watching, On hold, Dropped and shows with existing watches keep their authoritative tracking state. A Seen show can receive a rewatch wish after both applicable choices. Confirmation and Undo never write or change watches, scores, Seen status, passes or viewing activity from these fields.

The API adds server-owned row flags `wishlistShowChoice` and `wishlistRewatchChoice` and summary counts `wishlistShowChoiceCount` and `wishlistRewatchChoiceCount`. Counts include only actionable representative conflicts, not duplicates or unchanged titles. Uploaded flags do not authorize anything. Historical summaries without the new counts keep their existing rewatch UI behavior. `wishlistShows` is optional on confirmation, defaults to no conversion, and is retained for resume and receipts. The current UI uses one whole-show checkbox for the applicable rows and its existing rewatch choice; a broader review redesign remains separate.

### Member-facing strings for UX review

This is a compatibility adjustment to the current review, not its redesign. New text:

- “Want to See the show”
- “This file lists seasons or episodes of {count} show/shows. Add the whole show to your Wishlist. No episode progress is imported. Titles marked Seen also need your Want to rewatch choice.”
- “{count} title/titles marked Seen in GoodWatch or in this file”
- “Leave off Wishlist”
- “Needs your choice”
- “Choose Want to See the show to add whole shows from season or episode entries. Titles marked Seen also need your Want to rewatch choice.”
- “Your optional choices have been reset. Review them before adding titles.”
- “Seen at the source. Choose whether to add this title as Want to rewatch.”
- “This file lists a season or episode. Choose Want to See the show to add the whole show.”
- Season rows use `S{season}`; episode rows retain the existing `S{season} E{episode}` notation.

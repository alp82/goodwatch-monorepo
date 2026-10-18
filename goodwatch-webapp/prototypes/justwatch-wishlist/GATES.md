# Candidate gates for #708 (defined before measuring)

Written 2026-10-19 before the first harness run. The owner accepts or changes these at the final comparison. Capture and matching are measured separately. Every result states its denominator.

## Capture gates (JustWatch session to capture record)

- **C1 No contamination.** Zero titles that are only on the Seenlist, only tracked, or only liked appear as wishes. Denominator: negative-control titles in the reference.
- **C2 Recall on a clean run.** Every reference Watchlist title is captured, or the capture is not marked `complete`. Denominator: reference Watchlist titles.
- **C3 No false complete.** A capture is marked `complete` only after a clean `hasNextPage: false`, with no GraphQL errors, a stable `totalCount`, and captured plus skipped entries equal to that total. Every fault scenario ends `partial` or `unknown`. Denominator: fault scenarios.
- **C4 Terminal reason is recorded.** Each capture records why it stopped, its pages, cursors, totals, duplicates and skipped entries.
- **C5 Repeatability (real file only).** Two runs without list edits give the same set of native IDs.

## Conversion gates (capture record to shared wishlist JSON v1)

- **V1 Scope.** Every converted wish keeps the provider's movie or show type. A type the format can't hold becomes `unknown`, never a guess. Denominator: converted wishes.
- **V2 No guessed IDs.** Every `tmdbId` and `imdbId` in the file equals the value JustWatch returned in `externalIds`. The native `objectId` is never written as a TMDB ID. Malformed provider IDs are dropped and counted. Denominator: converted wishes.
- **V3 Native identity.** Every wish keeps the JustWatch node ID as `sourceId`. Repeated titles with different native IDs stay separate. A native ID returned twice becomes one wish.
- **V4 Loss is explicit.** Every source field that the shared format can't hold is listed in the loss table with a count. Nothing is silently dropped.
- **V5 Valid file.** The real parser accepts the envelope. Every wish that had valid source data parses without the `invalid` outcome.

## Preview gates (shared file to GoodWatch preview)

- **P1 Accounted for.** Every reference wish appears in the preview as exactly one row, found by `sourceId`. Denominator: captured wishes.
- **P2 No wrong match from good IDs.** When the provider IDs are correct, the preview match equals the expected catalog title. Denominator: wishes with provider IDs.
- **P3 Wrong provider IDs are visible.** A provider TMDB ID that contradicts its own IMDb ID is reported by the harness. This is a finding about the preview, not a pass condition for the exporter.
- **P4 Library semantics hold.** A wish already Seen in GoodWatch becomes a rewatch conflict, a show the member is Watching keeps its status, and an existing wish is unchanged.
- **P5 Partial stays additive.** A partial capture's preview warns about partial coverage and proposes no removals.

## What would make the route fail

- Any contamination (C1), any false `complete` (C3), or any guessed ID (V2) on the synthetic fixture.
- On the real file: a Watchlist title missing from a run marked `complete`, or two clean runs that disagree.

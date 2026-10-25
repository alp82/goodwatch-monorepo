# Profile Tropes loading

`/u/:handle/tropes` serves the first 30 ranked bands and their defining titles. It does not serialize the title–trope
matrix into the document. After hydration, a private resource request to `/u/:handle/tropes/data` obtains the matrix
for local filtering. Bands can open before that request finishes; filters and Show more wait until it succeeds.
A failed download leaves the preview intact with a retry action.

The owner's completed pool is stored in `profile_tropes_snapshot`, with Redis as a 10-minute fast tier. Expiry,
eviction or a deploy does not discard the durable snapshot. Reads return a stale snapshot while one background
build per owner and process refreshes it. A profile without any snapshot returns its frame and a preparing state
immediately, then polls the resource route until the build completes. Pending documents are not cached.
After a committed taste write, `markTasteChanged` schedules a trope refresh after the existing settling delay; it
retains the last completed pool. A write during an in-flight build schedules a further build after it finishes.
Version checks let polling reuse an unchanged matrix without downloading it again. Durable and Redis writes guard
against older builds replacing a newer snapshot. Catalog changes are picked up by the 10-minute refresh period.

General descriptions and canonical URLs come from the shared `trope_catalog` table. Heavy snapshots store no general
text, and legacy bundled text is discarded on read. The document requests only its first 30 exact trope names; the
full filtering resource batches its relevant names. A 400ms per-query budget bounds optional catalog reads; failed
reads omit optional text and prevent response caching. A catalog content fingerprint participates in the resource's
version check, so a new description is not hidden behind an unchanged profile snapshot timestamp.

Snapshots contain no viewer Seen state. Both the document and resource routes resolve the profile and its current
visibility before reading a snapshot. Viewer state is added per request; the full resource is private and no-store.
Excerpts remain fetched on demand, with the existing three visible hero previews. Profile tabs and the Taste page's
Tropes link already use Remix `prefetch="intent"`, which now prefetches the compact document data.

## Rollout

1. Ensure `trope_catalog` exists and import reviewed descriptions with `goodwatch-flows/scripts/import_trope_catalog.py`.
   The original 100 have already been seeded and verified in production; a fresh environment needs its own catalog
   import or database restore. See [the catalog pipeline](../tvtropes.md#general-trope-catalog).
2. Publish the changed `f/sync/models/crate_{schemas,models}`, `f/sync/copy/tvtropes`, and the new
   `f/sync/backfill/trope_lengths` Windmill script. Run the backfill with its default `dry_run: true` first.
3. Run `f/sync/backfill/trope_lengths` with `dry_run: false`. It creates the snapshot table, adds `trope.content_length`,
   and fills missing lengths in keyset batches (100 titles by default, at most 500). It is resumable; it never rewrites
   populated lengths. Subsequent trope imports maintain the column. The normal schema initializer also declares
   both additions.
4. Deploy the webapp. In its environment, prewarm any important existing profiles before opening their pages:

   ```sh
   cd goodwatch-webapp
   npx vite-node --config scripts/profile-tropes/vite.config.mjs scripts/profile-tropes/warm.ts alperortac
   ```

Do not deploy the app before the schema and backfill: its background builder reads the stored length column.
The first visit to an unwarmed profile stays responsive while its initial snapshot builds. The snapshot table
should be included in normal database backups; it can be rebuilt from ratings and catalog data.

## Verification

Measured on the public profile on 2026-10-25: the original first response took 23.4 seconds; an immediate repeat
finished in 0.6 seconds. The captured pool contained 1,008 titles, 4,001 tropes and 112,800 relationships.
Applying the preview projection to that pool reduces its JSON from 1,679,359 to 93,246 bytes (33,020 bytes gzip),
while retaining the same first 30 ranked tropes and all 237 of their defining titles. This is a payload measurement,
not a production latency measurement of the new implementation.

Regression tests cover cold and stale nonblocking reads, coalescing, hidden parts, viewer isolation, snapshot
expiry and Redis failure, invalidation settling, failed durable writes, corrupt fast copies, preview ranking and
size, and resumable backfill batches. The SQL was exercised against isolated CrateDB 5.10.16, including out-of-order
snapshot writes. Import lengths preserve Crate's UTF-16 `char_length` semantics.

The production build passed. Desktop (1440 px) and phone (390 px) browser checks of the isolated UI covered preview
rendering before the full-data response, opening a band while that response was delayed, enabling filters after
arrival, Show more, a cold build's polling transition, and a hidden profile making no data request. No runtime errors
or horizontal overflow were observed. A Lighthouse run of that isolated UI fixture scored 97 for performance and
92 for accessibility; these are fixture scores, not measurements of the deployed page. The existing repository-wide
TypeScript errors remain; no diagnostics were introduced by this change.

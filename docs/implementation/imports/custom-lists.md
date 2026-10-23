# Custom list imports (#758)

Letterboxd and Trakt archives and IMDb custom-list CSVs now offer a **Lists** kind
on `/settings/imports`. Confirm creates one GoodWatch list per named source list.
The owner decisions are enforced: keep the source name, start private, and create
a separate list on every new import. Repeating Confirm or resuming an interrupted
attempt reuses that attempt's list ID instead of creating another copy.

## Destination and privacy

This extends the existing `doc.user_list` store and its `createList`, `deleteList`
and `setListVisibility` functions, also used by MCP. There is no parallel list
table. Five-title share cards retain their editor and validation. Imported lists
use the same ordered `items` array with `collection_metadata` for description,
notes and the creating import's identity. Notes are retained per position, so
two source entries resolving to the same canonical title do not lose a note.

Private creation does not require a public handle. `/lists/mine` shows the lists,
including for members without a handle; `/lists/:id` shows their full contents
and notes. Private list contents require the owner, return 404 to everyone else,
and never enter the public share-card view or image renderer. The page always
uses `private, no-store`. Share list explicitly changes visibility to Unlisted
through the existing list API, using the existing handle picker when necessary.
The owner can make it private again or delete it. Profile list tiles and MCP reads
point to the full list page. The five-title editor cannot replace an imported
collection with five selected titles.

**Deployment:** apply
[`imported-lists-migration.sql`](../share-lists/imported-lists-migration.sql)
before deploying the webapp. The Windmill Crate schema includes the same column
for initialization. The migration has not been run against a live database.

## Source mapping

| Source data | GoodWatch behavior |
| --- | --- |
| Letterboxd `lists/*.csv` | One list per CSV, including the version-7 preamble and metadata table. Embedded Name and Description are retained; older files without an embedded name use their filename verbatim, minus `.csv`. Deleted/orphaned content is excluded as before. |
| Letterboxd Position / Description | Rank order and the individual film note. Films match by exact title and year using the existing catalog matcher. No viewing or Want to See intent is inferred. |
| Trakt `lists-lists.json` | Named list records with inline `items`, or metadata joined to `lists-<slug>.json` / `lists-<id>.json` contents. Name and Description are retained. |
| Trakt rank / notes / movie or show IDs | Rank order and per-entry notes, matched through the existing typed external-ID matcher. Explicit `items: []` creates an empty list. Metadata without a contents array/file is visibly unsupported, rather than silently becoming an empty list. |
| IMDb A custom list choice | One named list, using Position for order and Description for each entry's note. Personal ratings remain an independent selectable kind. Watchlist still means Want to See. |
| IMDb list name | Prefilled from the filename, with an editable field to check/correct the original source title. The CSV header does not carry a list name; no name is guessed from title rows. |
| Missing/ambiguous catalog match | Entry, source position and note remain visible in preview/receipt. The created list contains matched entries in source order. |
| Episode, season, person or other unsupported list entry | Visible in the source list details with its reason. No whole-show or movie membership is invented. |
| Reimport of the same source list | A new private list; no merge, overwrite or synchronization. |
| Undo | Deletes only list IDs created by that import, through the existing soft-delete function. Other lists remain intact. |

The source adapters remain file-only and use synthetic fixtures. No new API calls,
credentials, scraping or account authorization is added. Source list membership
never creates watches, scores, favorites or Want to See as a side effect. Existing
rating/watch imports and their recorded-date behavior stay independent. List
creation timestamps describe the GoodWatch creation, not an inferred watch date.

The normalized `list` observation holds the full ordered source entries alongside
catalog-match results. Its creation ID is written ahead to the import receipt.
`collection_metadata.importedBy` distinguishes this attempt from an existing list
with identical contents. A lost creation response can be retried without an orphan;
a lost deletion response can be undone again. List-created/deleted counts are
reported separately from changes to title tracking, and receipts link to the list.

## Evidence

- [Letterboxd's export page](https://letterboxd.com/user/exportdata/) documents that account archives include lists; the [FAQ](https://letterboxd.com/faq/) distinguishes curated lists from Watchlist and notes that deleted content is included in exports.
- [Letterboxd's IMDb migration guide](https://embed.letterboxd.com/about/migrating-from-imdb/) documents individual custom-list exports named `<List Title>.csv`. The editable title accommodates renamed files and export-version differences.
- [Trakt's own support forum export example](https://forums.trakt.tv/t/some-of-my-lists-set-to-private-got-emptied/106523) shows the typed movie identities, rank, listed-at and notes fields. No versioned archive schema was available from the API documentation during this session; synthetic tests specify the accepted inline and split-file shapes explicitly.

## Verification

Test-first cases cover parsers, normalized catalog matching, the Lists selector,
source names/order/notes, repeated imports, Confirm/Undo, lost create/delete
responses, private access, members without handles, and receipt counts/links.
A profile card reads only the first five imported-list titles while reporting the
full list size; opening the list reads its full contents in bounded catalog batches.

- Imports, IMDb, Imports UI and share-list suites: **647 passed, zero failures**.
- Webapp typecheck: **210 diagnostics**, identical to the starting baseline; none added.
- Broader MCP/profile run: **739 passed, seven failed** because this workspace lacks `@posthog/mcp` and `sharp`. All seven failures were reproduced against an untouched `origin/main` archive with the same installed dependencies.
- Crate schema Python syntax parsed successfully. No live database migration/import was performed.
- Chrome preview: Lists selected, source order and multiline notes visible, unmatched-entry explanation visible, Confirm sends `kinds: ["list"]`, no runtime errors or horizontal overflow at 390 px.
- [Desktop preview](custom-lists-preview-desktop.png) and [mobile preview](custom-lists-preview-mobile.png).

The screenshots render the real shared preview and stylesheet with data generated
by the synthetic service test. The surrounding Imports/Trakt headings are local
harness markup. No production member, real export or live source account was used.

TMDB and MDBList acquisition remain follow-up work, as scoped in #758. The shared
`list` observation and writer can be reused by those adapters. The main shared
integration points for the parallel #755 thread are `domain/imports.ts`,
`imports/preview.server.ts`, `imports/apply.server.ts` and `Imports` UI kind labels.
No blocking owner decisions remain.

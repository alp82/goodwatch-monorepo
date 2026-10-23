# Watcharr whole-library import (#756)

The Watcharr JSON upload now reads the full movie/show library through the existing
`wishlist` source. The original GoodWatch wishlist v1/v1.1 contract is unchanged.

## Official format and synthetic evidence

Inspected Watcharr at `c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf`:

- [Official importing documentation](https://watcharr.app/docs/importing/watcharr).
- [Export modal](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/src/routes/%28app%29/settings/ExportListModal.svelte): Settings → Export → Export Watched List → Export serializes the full authenticated `/watched` response as `watcharr-export.json`.
- [Watched entity](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/database/entity/watched.go): decimal scores are stored out of 10 regardless of the selected display scale.
- [Activity entity](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/database/entity/activity.go) and [creator](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/activity/creator.go): source ID, `createdAt`, optional `customDate`, `countAsPlay`, and activity kind.
- [Episode writer](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/feature/watched/episode/episode.go) and [season writer](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/feature/watched/season/season.go): `data` is a JSON-encoded string with `season`, `episode` where applicable, and `status`; completion activities are emitted with `countAsPlay: false`.

The new [synthetic library fixture](../../../goodwatch-webapp/app/server/imports/fixtures/watcharr-library-synthetic.json)
is constructed from that schema. It includes all five statuses, decimal scores,
multiline thoughts, two distinct play IDs at the same custom timestamp, a duplicate
copy of one play, the real paired Added/non-counted imported-date shape, an imported movie later marked Planned for rewatch, unrelated rating activity, season/episode records at every status,
scoped scores, tags, pinned, and a game. The earlier backend-produced synthetic
fixture remains in place. Neither fixture contains a member's export.

## Mapping

| Watcharr evidence | GoodWatch kind / behavior |
| --- | --- |
| Planned movie/show | `want`: Want to See. With past watches, offers the existing explicit Want to rewatch choice. |
| Finished movie, no play history | `watch`: Seen without a viewing date. |
| Finished show | `show_status: completed`, whole-show scope. Existing writer fills missing aired regular episodes with unknown-date watches. |
| Watching / Hold / Dropped show | `show_status: watching / on_hold / dropped`. Member decisions and post-preview edits retain the shared protections. |
| Watching / Hold / Dropped movie | Unsupported status; independent watches, scores and thoughts still import. |
| Movie/show score | `rating`: 0 is unset; positive values up to 10 round to the nearest whole number, minimum 1. A preview note explains decimal conversion. |
| Thoughts | `review`, retaining multiline text. |
| `countAsPlay: true` activity | `watch` per distinct source activity ID. Uses its `customDate`. An Added activity without one uses the non-counted original imported date, otherwise the entry’s `createdAt`; other activities use their own `createdAt`. |
| Export without `countAsPlay` | Explicit Added/Finished and imported-date activities supply legacy plays; the initial Added/imported-date pair counts once. Explicit false flags are respected. |
| Whole-show Finished play | Completion only for episodes with no watch in the export or GoodWatch. It never adds an episode rewatch. |
| Explicit Finished episode/season activity | Dated episode watches, despite scoped activity's false `countAsPlay`. Automated parent-status changes do not create additional plays. |
| Finished episode/season snapshot | Undated episode watches only where history has no watch. Snapshot insertion/update timestamps never become viewing dates. |
| Season/episode score or non-Finished scoped status | Visible unsupported observation; never applied as a whole-show score or status. |
| Tags / pinned / games | Visible unsupported observation. Pinned is not interpreted as Favorite; tags are not flattened into Want to See. |

Whole-show and season plays expand through the existing local TMDB episode catalog,
using canonical numbering. Bulk completion excludes future/undated episodes and
episodes released after the recorded play; no source API calls or scopes are added.
Individual episode evidence goes through the shared episode resolver. Source dates
are preserved even when many watches have the same date. Invalid dates produce a
visible note and undated watches. Distinct play IDs retain repeat viewings; duplicate
copies of one ID, season snapshots, and episode snapshots do not multiply history.
The existing explicit unknown-date import choice remains available.

A manual whole-show `STATUS_CHANGED` to Finished is completion evidence, not an
extra watch of every episode. Dated episode history and undated season/episode
snapshots take priority. Completion fills only episodes with no source or existing
GoodWatch watch. Multiple whole-show finishes fill once at the earliest recorded
completion date, independently of activity ordering. This follows the #756 review
decision and preserves existing per-episode dates.

Watcharr’s [import service](https://github.com/sbondCo/Watcharr/blob/c268fd22c8f248f3cf6ed6c778a9ceca0f91cabf/server/feature/imprt/import.go)
sets `countAsPlay: false` on the first `IMPORTED_ADDED_WATCHED` because the initial
`ADDED_WATCHED` already counts. The original viewing date is the former’s
`customDate`; the latter’s activity creation time is the import time. The parser
pairs them without creating another viewing. Jellyfin import, Jellyfin webhook,
and Plex-created activities (`createdBy: 3`, `4`, and `5`) remain eligible.

The shared writer still protects member-set On hold, Dropped and Seen. Its existing
rule also keeps Seen when the imported episode watches complete a previously
Watching show. This change does not alter the tracking state machine.

A rewatch wish selected alongside watches is applied after the tracking phase so
that importing the past watches cannot clear the current intention. It uses the
existing set journal and Undo path. The full Watcharr preview has independent
Leave off Wishlist / Add as Want to rewatch radios, separate from Keep my GoodWatch
changes / Use the export instead. The confirm API validates the explicit
`wishlistRewatch` boolean and retains it in the receipt and resume options.

Watcharr watch plans journal the original Want to See and Not interested dates
and which conditional deletions succeeded. Undo restores those entries after
undoing watches and scores, without overwriting a newer list choice or restoring
over newer watches or show-state decisions. The result records each successful
restoration. These restoration rules apply to new Watcharr plans; other import
sources retain their existing Undo behavior.

## Preview and verification

Watcharr previews with scores, watches, reviews or statuses use the existing general
Imports preview. Wishlist-only previews keep their existing matching/rewatch UI.
The rewatch choices reuse the wishlist preview’s wording and the Imports page’s existing radio controls.

- [Desktop preview](watcharr-preview-desktop.png).
- [Mobile preview](watcharr-preview-mobile.png).

The screenshots show the actual `SourceImportPreview` component and app stylesheet
inside a local browser harness, with the summary generated by the synthetic fixture
service test. The surrounding Imports headings are harness markup; this was not an
authenticated production account or a live database. Chrome exercised the date
choice and confirmed `rating`, `watch`, `want`, `review`, and `show_status` with
`watchDates: preserve` and `wishlistRewatch: true` while keeping `conflictChoice: keep`. There were no browser runtime errors or horizontal overflow
at 390 px.

Test-first parser and service cycles cover statuses, decimal conversion, thoughts,
play identities/dates, snapshots, scoped scores, malformed scoped activity, canonical
expansion, explicit rewatch choice, selected kinds, re-import deduplication, receipt,
and Undo. Rendered UI tests cover the general Watcharr preview and unchanged
wishlist-only preview. Service tests also cover preserving a whole-show bulk date
and deliberately importing it with unknown dates. Review regressions cover the real
Watcharr importer date pair and entry-date fallback, legacy exports without play
flags, provider-created activity, whole-show completion overlap (including unknown
snapshot dates), all four rating-conflict/rewatch combinations, HTTP validation and
option persistence, and Confirm/Undo of pre-existing Want to See and Not interested
for movies and shows. Undo tests also protect newer list choices and watches.

The complete imports run passed **577 tests**, with no failures:

```sh
node --test --test-concurrency=4 app/server/imports/*.test.ts app/server/imdb-import/*.test.ts app/ui/imports/*.test.ts
```

The tracking writer suite also passed **127 tests**, with one existing movie first-insert recovery TODO and no failures. Targeted receipt/service checks passed after the final receipt adjustment.

Typecheck baseline on the untouched `origin/main` base (`49d846b2`) was **206**
diagnostics in this environment, including missing auth-conformance dependencies;
the requested approximate 188–189 was not the observed baseline. After the change:
**206**, with identical diagnostic lines and none added.

The Fable review findings on `73dc6b34` are addressed in the follow-up commit.
Live Watcharr/CrateDB integration and re-review remain with the delivery workflow. No push, merge, deployment, or real-member import was performed.

## Follow-up decisions

No blocking implementation questions remain. Exact decimal-score storage, scoped
scores/statuses, general tag/list storage, and any pinned-to-Favorite policy require
separate destination-model/product decisions. The import reports those unsupported
fields instead of silently misapplying them.

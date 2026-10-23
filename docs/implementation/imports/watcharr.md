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
copy of one play, unrelated rating activity, season/episode records at every status,
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
| `countAsPlay: true` activity | `watch` per distinct source activity ID. Uses `customDate` if supplied, otherwise the activity's `createdAt`. |
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

The shared writer still protects member-set On hold, Dropped and Seen. Its existing
rule also keeps Seen when the imported episode watches complete a previously
Watching show. This change does not alter the tracking state machine.

A rewatch wish selected alongside watches is applied after the tracking phase so
that importing the past watches cannot clear the current intention. It uses the
existing set journal and Undo path.

## Preview and verification

Watcharr previews with scores, watches, reviews or statuses use the existing general
Imports preview. Wishlist-only previews keep their existing matching/rewatch UI.
No new page or section design was introduced.

- [Desktop preview](watcharr-preview-desktop.png).
- [Mobile preview](watcharr-preview-mobile.png).

The screenshots show the actual `SourceImportPreview` component and app stylesheet
inside a local browser harness, with the summary generated by the synthetic fixture
service test. The surrounding Imports headings are harness markup; this was not an
authenticated production account or a live database. Chrome exercised the date
choice and confirmed `rating`, `watch`, `want`, `review`, and `show_status` with
`watchDates: preserve`. There were no browser runtime errors or horizontal overflow
at 390 px.

Test-first parser and service cycles cover statuses, decimal conversion, thoughts,
play identities/dates, snapshots, scoped scores, malformed scoped activity, canonical
expansion, explicit rewatch choice, selected kinds, re-import deduplication, receipt,
and Undo. Rendered UI tests cover the general Watcharr preview and unchanged
wishlist-only preview. Service tests also cover preserving a whole-show bulk date
and deliberately importing it with unknown dates.

The complete imports run passed **566 tests**, with no failures:

```sh
node --test --test-concurrency=4 app/server/imports/*.test.ts app/server/imdb-import/*.test.ts app/ui/imports/*.test.ts
```

Typecheck baseline on the untouched `origin/main` base (`49d846b2`) was **206**
diagnostics in this environment, including missing auth-conformance dependencies;
the requested approximate 188–189 was not the observed baseline. After the change:
**206**, with identical diagnostic lines and none added.

Independent review and live Watcharr/CrateDB integration are left to the delivery
workflow. No push, merge, deployment, or real-member import was performed.

## Follow-up decisions

No blocking implementation questions remain. Exact decimal-score storage, scoped
scores/statuses, general tag/list storage, and any pinned-to-Favorite policy require
separate destination-model/product decisions. The import reports those unsupported
fields instead of silently misapplying them.

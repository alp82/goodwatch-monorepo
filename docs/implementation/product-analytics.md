# GoodWatch product analytics

The event vocabulary and allowed properties live in
`goodwatch-webapp/app/telemetry/product-events.ts`. Product code uses the browser
helper/hooks or the server helper; it does not import an SDK. PostHog's existing
pageviews, performance data, autocapture and replay stay in the deferred loader.
The extra custom `Pageview` event has been removed.

## Adding an event

1. Add its name to `PRODUCT_EVENTS` and any new structured fields to the property
   allowlist in the same file. Use the domain vocabulary from `CONTEXT.md`.
2. Capture an interaction in the browser, or a confirmed persisted outcome in the
   shared server writer. Keep them separate to avoid counting a click as a save.
3. Add context at the call site. Never include raw searches, reviews, names,
   emails, passwords, tokens, import file contents or whole user objects.

A React component can use a stable callback with automatically resolved identity:

```tsx
const track = useProductAnalytics({ source: "discover" })
track("title opened", { tmdb_id: 603, media_type: "movie", result_position: 4 })
```

Outside React, use `captureProductEvent` from `telemetry/product-analytics`.
`useProductExposure(event, key, properties)` emits when the displayed result key
changes, rather than when data is prefetched or a component rerenders. Exposure
keys remain in memory; search text in a key is never sent to PostHog.

Server writers use the identically named function from
`telemetry/product-analytics.server`:

```ts
captureProductEvent(userId, "rating saved", {
  tmdb_id: tmdbId, media_type: mediaType, score, previous_score: previousScore,
})
```

Use `analyticsAction(handler)` on a Remix action to carry safe discovery context
and the browser's PostHog session into every writer called by the action. Keep
helper functions private: exporting an additional server-dependent route helper
prevents Remix from stripping it from the browser build.

Use `productAnalyticsFetch` for browser mutation requests. It attaches session
and allowlisted discovery context to same-origin requests. The server always
uses the authenticated member ID supplied by its writer, never a claimed user
ID in a request header/body. Requests sent before the deferred SDK loads can
lack a PostHog session ID; their member identity is still available on the server.

`withProductContext({ origin: "import", import_id: id }, operation)` scopes
background work without mixing concurrent requests. Imports and undo use it.
MCP operations carry `source: "mcp"` through the same writers.

## Captured behavior

| Events | Meaning |
| --- | --- |
| `account created`, `email verified`, `sign in succeeded` | Server auth outcomes; creation and verification have stable receipts. |
| `sign in failed` | Failed browser email sign-in; records only a broad failure category, with anonymous identity when no member is known. |
| `taste quiz started`, `taste quiz completed` | Quiz entry and a goal reached through successfully saved scores. Existing member ratings do not count as a newly completed quiz. |
| `rating saved`, `rating cleared`, `review saved` | Scores saved, changed, cleared, imported or restored by import undo. Review presence is a boolean; review text is excluded. |
| `want to see added/removed`, `title skipped/unskipped`, `not interested added/removed`, `favorite added/removed` | Confirmed list/mark changes, including guest progress stored in the browser. |
| `discovery results shown`, `discovery filters changed` | Presented results and navigation between filter configurations. Results include actual applied services, moods, sort and For you state. TV and MCP result delivery have their own source. |
| `title opened` | Title-link activation or a title presented on the living room TV. The clicked grid position is recorded when available. |
| `availability checked`, `streaming service clicked` | Presented availability and explicit provider-link activation. A provider click is not proof of viewing. |
| `tracking action applied` | An accepted tracking command, including rate, Seen presses, episode/season/range actions, unwatch, restore, rewatch, state choices and watch-date edits. `action` preserves the machine's command name. |
| `watch state changed` | Persisted transitions between Not started, Watching, On hold, Dropped and Seen, including pass changes, score side effects, imports and undo. Carries previous/next state where known. |
| `watch logged`, `watch removed`, `watch date changed` | Persisted log changes. Bulk operations carry affected counts rather than pretending each episode was a separate user click. A batch spanning titles carries title IDs rather than attributing all watches to its first title. |
| `import started/completed/failed/undone` | Import lifecycle, source, receipt ID and result counts. No uploaded content or filename. |
| `settings changed`, `list saved/deleted`, `guest progress transferred` | Settings keys, list IDs/counts and completed transfer receipts. Private values and journal contents are excluded. |

Watch-log writes can be repaired or removed during a state-conflict retry. Use
`tracking action applied` for successful user-action counts, `watch state changed`
for transitions, and log-event counts for row changes; do not add all three as
though they were independent user actions. Imported/score-created episode rows
also do not represent separate viewing decisions.

## Identity and transport

Members use immutable account IDs for `distinct_id`, `user_id` and server
`$user_id`. Browser identification sends only the allowlisted member ID. Anonymous
browser events retain their PostHog identity, with `is_guest: true`. The two existing
internal member IDs are tagged and the project's test-user exclusions include
both their old email IDs and their immutable IDs.

The browser links a persisted legacy email identity before switching to the
account ID. The migration CLI links existing analytics identities before a
historical import creates new member profiles. Never use an arbitrary form email
or a user-supplied ID to merge people.

Server delivery uses bounded in-memory batches, a timeout and one retry with the
same event UUIDs. It never blocks or rejects a product save. Failures are logged;
this is best-effort analytics, not a durable audit log. The shutdown lifecycle
attempts to flush pending events.

Production server configuration:

```dotenv
POSTHOG_API_KEY=<the existing GoodWatch public project token>
POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_DISABLED=false
```

The token is already used by the browser and is not a personal API key. Configure
it on both production page processes before deploying the server instrumentation.
Non-production processes do not send live server events. Set `POSTHOG_DISABLED=true`
for preview processes running with `NODE_ENV=production`.

## Backfill and limits

`goodwatch-webapp/scripts/product-analytics/backfill.py` reads CrateDB through
read-only credentials, pages by primary key, assigns deterministic event UUIDs
and checkpoints after acknowledged batches. It defaults to a dry run. Its state
file must stay outside the repository. Always resume the same state file; never
restart an import using a fresh state file merely to retry a failed batch.

Example on crate-01, with `POSTHOG_API_KEY` provided in the environment:

```sh
python3 backfill.py --apply \
  --password-file /root/.config/goodwatch/crate-credentials/goodwatch_readonly \
  --auth-password-file /root/.config/goodwatch/crate-credentials/goodwatch_auth \
  --state /root/.local/state/goodwatch/analytics-backfill.json
```

`migrate-identities.mjs` runs inside a production webapp container, using its auth
codec and existing auth environment. `ANALYTICS_KNOWN_IDS_FILE` contains only
previously observed internal account IDs. It decrypts user payloads in memory,
sends aliases and stores only ID receipts. Neither auth secrets nor email mapping
files leave the container. Preserve its state file on the host after execution.

On October 20, 2026, 427 existing account identities were linked and **300,456**
historical events were accepted and reconciled against PostHog:

| Source | Events |
| --- | ---: |
| Accounts | 738 |
| Current ratings | 10,395 |
| Surviving Want to See records | 2,107 |
| Skips | 13,945 |
| Not interested | 3 |
| Favorites | 73 |
| Watch-log rows | 263,911 |
| Current watch states | 9,273 |
| Nondeleted lists | 6 |
| Completed/undone imports | 5 |

The database was only read. Backfill receipts are on crate-01 at
`/root/.local/state/goodwatch/analytics-backfill.json`; identity receipts are on
the page host at `/root/.local/state/goodwatch/analytics-identities.json`.

Every imported event has `backfilled: true`, `backfill_version:
goodwatch-records-v1`, `source: database_backfill` and `history_precision`.
Ratings and states preserve only the surviving value, not overwritten history.
A backfilled state has an unknown `from_state`. Deleted records, original click
sources/positions, unrecorded changes and historical signup verification/sign-in
outcomes cannot be reconstructed. Watch events use when the record was created,
not the date someone says they watched a title.

For live engagement/activation reports exclude `backfilled=true`; distinguish
manual actions, imports, undo, guest transfers and score-created watches. Do not
present surviving-row backfills as a complete historical activity log.

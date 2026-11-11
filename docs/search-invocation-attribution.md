# Search invocation attribution

Search history and the spending ledger store a versioned `attribution` object. This makes typing previews, explicit searches, title links and API use distinguishable when investigating JEV spend. No new calls or search events are created merely to record a keypress or a click.

| Field | Meaning |
| --- | --- |
| `consumer` | `web`, `yepwatch`, `mcp`, `discord`, `unknown`; chosen by the server entry point |
| `surface` | `start`, `header`, `discover`, `title_tag`, `title_trope`, `quick_list`, `tv`, or the integration name |
| `trigger` | `typing_pause`, `enter`, `search_button`, `selection`, `link`, `navigation`, `retry`, `filter_change`, `api`, `unknown` |
| `actor_kind` | `member`, `guest`, `external`, `unknown`; derived from verified server context |
| `search_id` | Server-generated invocation UUID shared by that request's history and paid ledger entries |
| `reported_by` | Whether the origin was reported by a browser or an authenticated server integration |
| `version` | `1` |

Browser origin labels are bounded diagnostics, not authentication or proof of human activity. The browser cannot choose its consumer, account identity, integration actor or search ID. YepWatch forwards only a member/guest category from the verified room participant, after authenticating to the search service. Old YepWatch callers have an unknown actor, rather than being counted as guests. Discord identities are external; MCP uses its verified account.

The start field's 800 ms pause, Discover preview's 600 ms pause and quick list's 400 ms pause are `typing_pause`; individual keystrokes do not invoke JEV. Start, header and Discover distinguish Enter from their Search button. Suggested phrases are `selection`. Title essence tags and tropes carry `link` origin through router history state. Direct visits, reloads, Back/Forward and new tabs without that state are `navigation`. TV submissions are remote selections. Origin state is never appended to the URL or a cache key.

Pressing Enter after an identical preview has already started does not create another invocation. That preview retains its original cause. Cache hits that actually reach the server get current-request attribution in history but do not relabel the earlier paid attempt. Browser cache reuse creates neither a server history row nor a ledger row. These records therefore measure server work and spending, not every UI interaction or search conversion. A prefetched route loader does not run JEV.

## Accounting and failure behavior

The positive spending estimate is persisted with attribution before provider dispatch. Settlements, canceled claims and later manual reconciliations copy the original estimate's attribution and budget timestamp. Grouping the **sum of all ledger amounts**, including negative adjustments, therefore retains correct source totals even if the request is canceled or history fails. Unknown provider costs remain reserved until reconciled. Each JEV stage currently makes two provider requests; ledger attempts are not provider-request counts. Translation reservations, when enabled, share the invocation ID too.

History records completed/basic/cached searches and latency; it is best effort. It is not a complete failure or cancellation counter. The spending ledger is the source for money. Existing encrypted query/evidence fields remain encrypted; attribution adds only enums, a version and a random ID. Old rows stay null and must be reported as unknown, without guessing member/guest or trigger.

## Rollout

Apply [the additive migration](../goodwatch-webapp/scripts/migrations/2026-11-11-search-attribution.sql) **before deploying** the webapp and search roles. Check `information_schema.columns` for both attribution roots and all seven children. For installations using the Windmill schema initializer, the same declarations are in `crate_schemas.py`; its normal missing-column check is safe on repeat runs. The standalone SQL is for a one-time migration: skip an already existing root after verifying its definition.

Deploy search receivers before YepWatch callers: the older strict YepWatch search receiver rejects the new optional `actor` field. The new receiver accepts old callers. Rollback to old application code can leave these additive columns in place. No production migration or deployment is performed by the code change itself.

## Billing-cycle queries

Supply the actual billing-period boundaries (the 17th to the next 17th), with explicit timezone, as the two parameters. Do not use a calendar-month filter. The ledger's `budget_at` keeps adjustments in the period that reserved them; this query does not change runtime budget admission settings.

```sql
SELECT coalesce(attribution['consumer'], 'unknown') AS consumer,
       coalesce(attribution['surface'], 'unknown') AS surface,
       coalesce(attribution['trigger'], 'unknown') AS trigger,
       coalesce(attribution['actor_kind'], 'unknown') AS actor,
       sum(amount_nano) / 1000000000.0 AS reserved_or_settled_usd
FROM doc.search_spending
WHERE budget_at >= ? AND budget_at < ?
GROUP BY 1, 2, 3, 4
ORDER BY reserved_or_settled_usd DESC;
```

Compare these totals with request volume and latency in history:

```sql
SELECT coalesce(attribution['consumer'], 'unknown') AS consumer,
       coalesce(attribution['surface'], 'unknown') AS surface,
       coalesce(attribution['trigger'], 'unknown') AS trigger,
       coalesce(attribution['actor_kind'], 'unknown') AS actor,
       outcome, count(*) AS requests,
       avg(elapsed_ms) AS mean_ms, percentile(elapsed_ms, 0.95) AS p95_ms
FROM doc.search_history
WHERE created_at >= ? AND created_at < ?
GROUP BY 1, 2, 3, 4, 5
ORDER BY requests DESC;
```

For individual traces, join spending `attribution['search_id']` to history's same field. Exclude null/`unknown` IDs when joining historical or internal unlabelled callers. Do not sum history costs and ledger costs together.

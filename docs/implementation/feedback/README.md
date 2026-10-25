# Feedback reports (#763)

`POST /api/feedback` accepts JSON using `FeedbackRequest` and `submitFeedback` in
`goodwatch-webapp/app/utils/feedback.ts`. All four kinds are available to guests.
Data reports are evidence only; this endpoint never applies catalog corrections.

Use a UUID idempotency key per report, unchanged on retries, `website: ""` (honeypot),
and `startedAt` set when the form opens. Submission requires 2 seconds to 24 hours.
Messages are 1–10,000 characters. Only `contact` requires a sender email. Identity
comes from a fresh server session. The same-origin Origin header is mandatory.
The JSON body cap accommodates a 2 MiB image plus 64 KB of report fields. Screenshots
are raw base64 JPEG/WebP, decoded and re-encoded to WebP without metadata, limited
to 16 million pixels and 2 MiB both before and after encoding.

Rates follow the existing wrong-title handler: fixed windows in process, hashed
addresses, bounded counters, reset on restart. Guests: 5/hour/address. Members:
20/hour/address AND 20/hour/member. Limits are not shared across app replicas.
Retries consume rate allowance, but atomic primary-key insertion ensures they do
not create another row or notification. Guest deduplication is scoped to address;
member deduplication is scoped to member. Report IDs are opaque SHA-256 hashes.

Only declared metadata fields are accepted. URL credentials, origins, fragments,
and query parameters whose names contain key/token/secret/code/state/auth/password/
credential/session are discarded. Source URLs receive the same query cleaning.
Country comes from `CF-IPCountry` when present (ingress must overwrite it), user agent
from the request, and commit from `GIT_COMMIT`, then `SOURCE_COMMIT`, else `unknown`.
Never add cookies, local storage, raw headers, session tokens, or session email.
Free text and screenshots remain user supplied; automatic secret detection in them
is not promised. Discord display fields strip URLs, emails, mentions and Markdown.

## Deployment

The table is registered in `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`,
like `user_avatar`. The app never creates it. Before deploying, an operator must run
Windmill `f/sync/init/cratedb` with `dry_run=true`, review the changes (the initializer
checks all registered tables), then apply with `dry_run=false`. No initializer was
run for this ticket. Equivalent DDL for this table:

```sql
CREATE TABLE doc.feedback_report (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL,
 message TEXT NOT NULL,
 payload OBJECT(IGNORED),
 metadata OBJECT(IGNORED),
 member_id TEXT,
 sender_email TEXT INDEX OFF,
 status TEXT NOT NULL DEFAULT 'new',
 discord_message_id TEXT,
 discord_thread_id TEXT,
 screenshot TEXT INDEX OFF STORAGE WITH (columnstore = false),
 created_at TIMESTAMP WITH TIME ZONE NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
```

Environment (documented in `goodwatch-webapp/.env.example`):

- `FEEDBACK_DISCORD_WEBHOOK_URL`: webhook for the private staff forum. Only HTTPS
  discord.com webhook URLs are accepted. Each report creates a thread with
  `thread_name`; `wait=true` returns the message and channel/thread IDs for storage.
- `FEEDBACK_DISCORD_TAG_IDS`: optional JSON map of kind to Discord tag snowflake.
- `FEEDBACK_STAFF_MEMBER_IDS`: comma-separated internal GoodWatch member IDs.
  `GET /api/feedback/:reportId/screenshot` requires a fresh authenticated session
  matching this allowlist and returns private/no-store WebP. Empty denies everyone.
  No reusable webapp staff-role authorization currently exists; a future Discord
  staff-role bridge can replace this explicit, server-owned authorization boundary.
- Existing `AUTH_SMTP_USER` / `AUTH_SMTP_PASSWORD`: Purelymail SMTP transport;
  recipient/from is hello@goodwatch.app and validated sender email is Reply-To.
- Existing `APP_ORIGIN`, `GIT_COMMIT` / `SOURCE_COMMIT`.

Unset webhook means store plus email. Contact always emails, including after Discord
success. Discord requests use native undici fetch with a 10-second timeout covering
the response body. A failed notification never undoes a stored report. If SMTP also
fails, the row remains and a report-ID-only error is logged; there is no durable
notification retry worker in this ticket. A crash between insert and delivery can
likewise leave an unnotified row. Receipts are stored separately after sending.

## Verification

Install the isolated Vitest runner with `npm install` in
`goodwatch-webapp/scripts/feedback-tests`, then run `npm test` there. Tests mock all
storage and outbound delivery and never contact Crate, Redis, SMTP or Discord.
A cached Vitest 5.0.5 runner was used in the restricted implementation environment.
Run `npm run typecheck` from `goodwatch-webapp` for app checks.

A real staff-forum test post remains an operator deployment check: this work did
not contact production services. Configure the webhook, tags, staff IDs and apply
the schema before that check.

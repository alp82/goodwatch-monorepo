# Feedback reports

`POST /api/feedback` is the one entry point for every report kind: `bug`, `idea`, `data`, and `contact`. Guests can send every kind. Each report is stored in Crate, posted to the private staff Discord forum, and emailed for contact messages and when Discord fails. Data reports are evidence only. This endpoint never changes catalog data.

Issue: [#763](https://github.com/alp82/goodwatch-monorepo/issues/763). Map: [#762](https://github.com/alp82/goodwatch-monorepo/issues/762). Owner decisions: `docs/research/user-feedback-channels.md`.

## Code

| Path | Role |
| --- | --- |
| `goodwatch-webapp/app/routes/api.feedback.ts` | The route. `POST` only. |
| `goodwatch-webapp/app/routes/api.feedback.$reportId.screenshot.ts` | Serves a stored screenshot to staff. |
| `goodwatch-webapp/app/server/feedback/handler.server.ts` | Request checks, rate limit, storage, Discord, email fallback. Takes its store, limiter, session, and mail as dependencies, so the tests run without services. |
| `goodwatch-webapp/app/server/feedback/schema.ts` | The zod schema, `safePath` (query secret removal), and `display` (Discord text sanitizing). |
| `goodwatch-webapp/app/server/feedback/runtime.server.ts` | Wires the handler to Crate, the shared rate limiter, the session, and SMTP. |
| `goodwatch-webapp/app/server/feedback/mail.server.ts` | The email for a report. |
| `goodwatch-webapp/app/utils/feedback.ts` | `FeedbackRequest` and `submitFeedback` for the browser. |
| `goodwatch-flows/windmill/f/sync/models/crate_schemas.py` | The `feedback_report` table. |

## Request

The body is JSON in the shape of `FeedbackRequest`. The browser sends:

- `kind`, `message` (1 to 10,000 characters).
- `idempotencyKey`: a UUID per report. Keep it unchanged on a retry.
- `website`: the honeypot. Always the empty string.
- `startedAt`: the time the form opened, in epoch milliseconds. A report sent less than 2 seconds or more than 24 hours after that is refused.
- `email`: required for `contact`, optional otherwise.
- `data`: required for `data` reports and refused for the other kinds. Entity kind, ids, field, current and suggested value, source link, country, provider ids.
- `metadata`: URL, route id, viewport, device pixel ratio, locale, color scheme, time, Sentry replay id. Only these fields are accepted.
- `screenshot`: raw base64 (no data URL) of a PNG, WebP, or JPEG of at most 2 MiB.

The server adds the user agent, the country from `CF-IPCountry`, the build commit from `SOURCE_COMMIT` (Coolify sets it), and the time it received the report. The member id comes from the session only. A member id in the body is refused.

### Checks, in order

1. `Origin` must be the site's origin (`APP_ORIGIN`, or `https://goodwatch.app` in production), and `Sec-Fetch-Site`, when present, must be `same-origin`. Otherwise 403.
2. `Content-Type` must be JSON. Otherwise 415.
3. The body is read up to 2 MiB of base64 plus 64 KB. Larger bodies are 413, malformed JSON 400.
4. The schema, the honeypot, and the time window. Failures are 400.
5. The rate limit. Guests: 5 an hour per address. Members: 20 an hour per member and 20 an hour per address. Refusals are 429 with `Retry-After`.
6. The screenshot is decoded with sharp (16 million pixel cap, no animation), rotated by its EXIF orientation, and re-encoded as WebP without metadata. Wrong formats are 400, oversized results 413.

The rate limit uses the shared limiter in `app/server/rate-limit.server.ts`. It counts in Valkey, so every webapp instance shares the count, and falls back to this process's memory when Valkey is not reachable. The limiter keys hold a hash of the address, never the address.

### Idempotency

The report id is a SHA-256 hash of the sender (member id, or the hashed address for a guest) and the idempotency key. The row is inserted with `ON CONFLICT (id) DO NOTHING`. A retry that finds its row gets 200 with the same id and sends nothing again.

## Storage

Table `doc.feedback_report`, one row per report: id, kind, message, `payload` (the data report), `metadata`, member id, sender email, status (`new`), Discord message and thread id, the screenshot as base64 WebP, created at. The screenshot column is stored like `doc.user_avatar.data`: `INDEX OFF`, no column store.

The table is registered in `crate_schemas.py` next to `user_avatar`. The webapp never creates tables and runs nothing against Crate at startup. Create the table by running the Windmill script `f/sync/init/cratedb` with `dry_run=true`, reviewing the plan, then running it with `dry_run=false`. Equivalent DDL:

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

### Before the table exists

A deploy to main goes live before an operator runs the schema sync. Until then the insert fails. The handler logs the failure, still posts the report to Discord and emails it, and answers 200. Only when storage, Discord, and email all fail does it answer 503. The screenshot route answers 503 while the table is missing. Nothing else on the site is affected.

## Discord

The webhook URL must be an `https://discord.com/api/.../webhooks/...` URL. The handler posts one forum post per report with `?wait=true`, a `thread_name` of the kind and the first words of the message, the kind's tag from `FEEDBACK_DISCORD_TAG_IDS`, and `allowed_mentions: {"parse": []}`. The embed holds the message, the report id, the member id or `Guest`, the metadata, and the data report. Every display string goes through `display`, which removes links, email addresses, mentions, angle-bracket markup, Markdown characters, and control characters, and caps the length under Discord's limits (thread name 100, description 4096, field 1024, embed 6000). Screenshots are attached as `screenshot.webp`.

The request uses `nativeFetch` (undici) with a 10 second timeout. The polyfilled global `fetch` crashed production when an abort fired during a request with a body (October 23, 2026); do not switch back.

Nothing from a member other than the id reaches Discord: no email, no cookies, no tokens. The message id and channel id from the answer are written to the row.

## Email

`feedbackMail` sends to `hello@goodwatch.app` from the same address through the existing Purelymail transport (`AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD`). Reply-To is the validated sender email, which is required for contact messages. The handler emails:

- every `contact` report, also after Discord succeeded;
- every report when `FEEDBACK_DISCORD_WEBHOOK_URL` is unset or Discord fails.

A delivery failure after the row is stored is logged with the report id and never fails the request. There is no retry worker; an unnotified row is found by its `discord_message_id IS NULL`.

## Screenshots for staff

`GET /api/feedback/:reportId/screenshot` returns the WebP with `Cache-Control: private, no-store`. The caller must be signed in and listed in `FEEDBACK_STAFF_MEMBER_IDS`. An empty list denies everyone. The webapp has no staff role; the allowlist is the only staff check, and it stays server side.

## Environment

All of these are optional. Without them the endpoint stores reports (once the table exists) and logs the delivery failures.

| Variable | Purpose |
| --- | --- |
| `FEEDBACK_DISCORD_WEBHOOK_URL` | The private staff forum's webhook. |
| `FEEDBACK_DISCORD_TAG_IDS` | JSON map of kind to forum tag id, such as `{"bug":"123","idea":"456","data":"789","contact":"012"}`. |
| `FEEDBACK_STAFF_MEMBER_IDS` | Comma separated member ids allowed to read screenshots. |
| `AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD` | Existing SMTP credentials for the email path. |
| `APP_ORIGIN`, `SOURCE_COMMIT` | Existing. The origin check and the build commit in the metadata. |

## Tests

```sh
cd goodwatch-webapp
node --test app/server/feedback/handler.test.ts
```

The tests use fakes for storage, the limiter, the session, Discord, and email. They cover validation, origin, body cap, both rate limits, the hashed limiter key, query secret removal, the Discord payload and its sanitizing, the email fallback, idempotency, the soft storage failure, screenshot normalization, and the staff check.

## Release checklist

1. Create the Discord forum channel and its four tags, then a webhook for it.
2. Set `FEEDBACK_DISCORD_WEBHOOK_URL`, `FEEDBACK_DISCORD_TAG_IDS`, and `FEEDBACK_STAFF_MEMBER_IDS` in Coolify.
3. Run `f/sync/init/cratedb` (dry run, then apply) to create `doc.feedback_report`.
4. Send one report of each kind from the site and check that each post carries the right tag.

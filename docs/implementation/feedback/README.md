# Feedback reports

`POST /api/feedback` is the one entry point for every report kind: `bug`, `idea`, `data`, and `contact`. Guests can send every kind. Each new report is stored in Crate, posted to the private staff Discord forum, and emailed for contact messages and when Discord fails. Data reports are evidence only. This endpoint never changes catalog data.

Issue: [#763](https://github.com/alp82/goodwatch-monorepo/issues/763). Map: [#762](https://github.com/alp82/goodwatch-monorepo/issues/762). Owner decisions: `docs/research/user-feedback-channels.md`.

## Code

| Path | Role |
| --- | --- |
| `goodwatch-webapp/app/routes/api.feedback.ts` | The route. `POST` only. |
| `goodwatch-webapp/app/routes/api.feedback.$reportId.screenshot.ts` | Serves a stored screenshot to staff. |
| `goodwatch-webapp/app/server/feedback/handler.server.ts` | Request checks, rate limit, storage, Discord, email fallback. Takes its store, limiter, session, and mail as dependencies, so the tests run without services. |
| `goodwatch-webapp/app/server/feedback/discord-post.ts` | The staff post, the duplicate reply, and the Details answer as Components V2. Pure builders. |
| `goodwatch-webapp/app/server/feedback/discord.server.ts` | Delivery (bot, then webhook) and the staff check behind the Details button. |
| `goodwatch-webapp/app/server/feedback/schema.ts` | The zod schema, `safePath` (query secret removal), and `display` (Discord text sanitizing). |
| `goodwatch-webapp/app/server/feedback/store.server.ts` | Crate queries, duplicate merging, and screenshot storage. Runs no queries at module load. |
| `goodwatch-webapp/app/server/feedback/runtime.server.ts` | Wires the handler to Crate, the shared rate limiter, the session, and SMTP. |
| `goodwatch-webapp/app/server/feedback/mail.server.ts` | The email for a report. |
| `goodwatch-webapp/app/utils/feedback.ts` | `FeedbackRequest` and `submitFeedback` for the browser. |
| `goodwatch-webapp/app/ui/support/ContactSection.tsx`, `contact.ts` | The contact form on `/support` ([#764](https://github.com/alp82/goodwatch-monorepo/issues/764)). Sends kind `contact` with the topic, and for data questions the title, at the top of the message. |
| `goodwatch-flows/windmill/f/sync/models/crate_schemas.py` | The `feedback_report` and `feedback_screenshot` tables. |

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

The report id is a SHA-256 hash of the sender (member id, or the hashed address for a guest) and the idempotency key. The row is inserted with `ON CONFLICT (id) DO NOTHING`. A retry that finds its row gets 200 with the same id and sends nothing again. Merged submission ids are recorded in the original row's `metadata.feedbackSubmissionIds`, so their retries return the original report id without increasing the count, including after triage closes the report. Rate limits still apply to retries.

## Storage

Table `doc.feedback_report` holds report text, the data payload, metadata, sender identity, triage fields, and the Discord receipt. It never holds screenshot bytes. `has_screenshot` starts as false and becomes true after the screenshot row is stored. A failed marker update can leave it false even when the screenshot exists. The staff route reads the screenshot table directly.

Table `doc.feedback_screenshot` holds one normalized WebP per report, keyed by `report_id`. Its `data` column stores base64 with `INDEX OFF` and no column store, as `doc.user_avatar.data` does. Its shard and replica settings also match `user_avatar`. Screenshot storage runs after the report insert. A screenshot write failure is logged and does not fail the report or remove the Discord attachment. A merged submission retains the original report's stored screenshot; its own screenshot is attached to the thread reply only.

### Duplicate data reports

For `data` reports, `dedupe_key` is the SHA-256 hex digest of canonical JSON with these fields in this order: `entityKind`, `ids`, `field`, and `suggestedValue`. Identifier keys are sorted lexicographically and identifier values are converted to strings, so `603` and `"603"` match. String suggestions are trimmed and lowercased. Numeric, boolean, and null suggestions keep their type. An omitted suggestion omits that JSON field and differs from explicit null. Field names are unchanged. Message, current value, source, country, and provider ids do not affect the key. Other report kinds store a null key.

When a report with the same key has status `new` or `in_progress`, the handler increments its `duplicate_count`, sets `updated_at`, and returns `200 {"reportId":"<original id>"}`. It replies in the existing Discord thread instead of creating a forum post. Closed reports, and rows with a status this build does not know, do not absorb new submissions. If several open rows exist, the oldest wins, with id as the tie breaker.

Crate has no unique constraint for a non-primary-key column. A `REFRESH TABLE` before the lookup narrows the visibility window. A version-checked update prevents lost increments and merging into a report that staff closed after the read. Conflicts trigger up to three attempts. Concurrent first submissions can still both insert rows with the same key. This trade-off is accepted for this ticket. A storage error still takes the delivery fallback described below, so deduplication is best effort while Crate is unavailable.

### Triage fields

`FEEDBACK_STATUSES` in `schema.ts` is the single TypeScript status definition. The store validates statuses with its derived zod schema. The endpoint creates reports as `new` and does not accept status or staff identity from visitors.

| Status | Meaning |
| --- | --- |
| `new` | Awaiting review. |
| `in_progress` | Staff are reviewing or working on the report. |
| `done` | The reported work is complete. |
| `wont_fix` | Staff decided not to act. |
| `duplicate` | Staff identified another report as the canonical report. |

`updated_at` is nullable and records the last change when set, including duplicate increments. `handled_by` is a nullable staff member id for future triage. It starts as null. No staff update endpoint or UI is included. `correction_id` is a nullable reference to the future `doc.catalog_correction` row from [#766](https://github.com/alp82/goodwatch-monorepo/issues/766). This endpoint does not write it.

### Create the tables

Both tables are registered in `crate_schemas.py` next to `user_avatar`. The webapp never creates tables and runs nothing against Crate at startup. Run the Windmill script `f/sync/init/cratedb` with `dry_run=true`, review the plan, then run it with `dry_run=false`. Equivalent DDL:

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
 dedupe_key TEXT,
 duplicate_count INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMP WITH TIME ZONE,
 handled_by TEXT,
 correction_id TEXT,
 has_screenshot BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMP WITH TIME ZONE NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');

CREATE TABLE doc.feedback_screenshot (
 report_id TEXT PRIMARY KEY,
 data TEXT INDEX OFF STORAGE WITH (columnstore = false),
 content_type TEXT NOT NULL,
 bytes INTEGER,
 created_at TIMESTAMP WITH TIME ZONE NOT NULL
) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = '0-1');
```

This listing describes the final schema for new tables. If the earlier schema was applied, review an explicit migration to add the report columns and move existing screenshot data before removing the old `screenshot` column. Review the sync plan rather than assuming it migrates existing evidence.

### Before the tables exist

A deploy to main goes live before an operator runs the schema sync. Until then the report insert fails if `doc.feedback_report` is missing. The handler logs the failure, still posts the report to Discord and emails it, and answers 200. Only when storage, Discord, and email all fail does it answer 503. If only `doc.feedback_screenshot` is missing, the report still stores and delivers, and the screenshot storage error is logged. The screenshot route answers 503 while its table is missing. Nothing else on the site is affected.

## Discord

Every post is a Components V2 message (`flags: 1 << 15`) in the look of the GoodWatch bot's cards: an amber container and link buttons below it.

- **Heading:** the kind with an emoji (🐞 Bug, 💡 Idea, 🛠️ Data fix with the entity name, ✉️ Contact).
- **Context line** (subtext): `Guest` or `Member @handle` (the public profile handle only; never a name, email, or member id), the country flag, the page path, locale, color scheme, and a live relative time (`<t:…:R>`).
- **The message** as the main text. Links and email addresses are replaced with "(link removed)" and "(email removed)", Markdown and `<` are escaped, `@` is followed by a zero-width space, line breaks are kept. Above 2,400 characters it is shortened with a note; the full text is in Crate and the email.
- **Data reports:** the field in words ("Where to watch") and the country, then `Was:` and `Now:` and the source's domain. The entity name comes from `data.entityName`, which the reporting page sends (optional, not part of the dedupe key).
- **Contact:** a note that the message was also emailed to hello@goodwatch.app.
- **Buttons:** Open page (the reported GoodWatch URL), TMDB and IMDb when the ids allow (`tmdb_id`/`tmdbId`/`tmdb`, `imdb_id`/`imdbId`/`imdb`, plus season and episode numbers), `Source · <domain>`, and Details. Link buttons over 512 characters are left out.
- **Technical details** (report id, member id, route id, device from the user agent, viewport, build commit, Sentry replay id, dedupe key, received time) never show in the open. See below.

The thread name is the kind and the first words of the message, or for data reports the entity and field (`Data fix: The Bear · Where to watch`), at most 100 characters. Tags come from `DISCORD_FEEDBACK_TAG_IDS`. Mentions are disabled on every message (`allowed_mentions: {"parse": []}`). The builders check Discord's limits themselves: 40 components, 4,000 characters of text, 80-character button labels, 512-character button URLs.

### Delivery: bot first, then webhook

1. **Bot** (`DISCORD_BOT_TOKEN` and `DISCORD_FEEDBACK_FORUM_CHANNEL_ID`): `POST /channels/{forum}/threads` with the post as the starter message. The bot owns the message, so the post carries the **Details** button. A screenshot is uploaded as `files[0]` and shown in a media gallery (`attachment://screenshot.webp`).
2. **Webhook** (`DISCORD_FEEDBACK_WEBHOOK_URL`, used when the bot is not configured or its request fails): `?wait=true&with_components=true`. Discord lets a webhook the application doesn't own send only non-interactive components, so instead of the button the post ends with one subtext line behind a spoiler (`-# Details ||…||`). Discord refuses `files[n]` together with Components V2 on a webhook, so a screenshot follows as its own plain message in the thread. If that second message fails, the failure is logged and the report still counts as delivered.

If every configured way fails, the report is emailed.

Unverified against Discord: the Start Thread in Forum docs list only `SUPPRESS_EMBEDS` and `SUPPRESS_NOTIFICATIONS` as starter-message flags. If Discord refuses `IS_COMPONENTS_V2` there, the bot request fails and the webhook path posts the report, so nothing is lost, but there is no Details button. Check the first bot post after the bot gets access.

### Details button

The button's custom id is `gw1:feedback-details:<report id>`. The press reaches `POST /api/discord/interactions` (`router.server.ts`), which answers before the member rate limit:

- Staff only, deny by default: the presser's Discord user id must be in `DISCORD_FEEDBACK_STAFF_USER_IDS`, or, in a server, one of their roles in `DISCORD_FEEDBACK_STAFF_ROLE_IDS`. Others get "Only GoodWatch staff can see report details." The check runs before any storage read.
- The answer is ephemeral (only the presser sees it): a card "Report details" with kind, status, and submission count, then report id, member id, page and route, device (browser and OS, viewport, color scheme, locale, country), the full user agent, build commit, received time, Sentry replay id, and dedupe key, plus a Screenshot link button to the staff screenshot route when one is stored.
- The row is read with `feedbackStore.details` (one primary-key read, 2.5 second budget). A missing row says the report isn't stored.

### Duplicates

A duplicate replies in the original thread (bot: `POST /channels/{thread}/messages`; webhook: `thread_id`) with a small note: `**+1 duplicate** (3 total)` with the new submitter's context line, their message as a quote, what they see and their source when given, and the spoilered details line. The merged submission has no row of its own, so its details are always inline. The reply has no thread name and no tags and keeps the original Discord receipt. If the original report has no thread receipt, the handler logs the failure and emails the submission without opening another post.

Every request uses `nativeFetch` (undici) with a 10 second timeout. The polyfilled global `fetch` crashed production when an abort fired during a request with a body (October 23, 2026); do not switch back.

Nothing from a member other than the public handle reaches the visible post; the member id appears only behind the Details control. No email, no cookies, no tokens. The message id and thread id from the answer are written to the row.

## Email

`feedbackMail` sends to `hello@goodwatch.app` from the same address through the existing Purelymail transport (`AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD`). Reply-To is the validated sender email, which is required for contact messages. The handler emails:

- every `contact` report, also after Discord succeeded;
- every report when `DISCORD_FEEDBACK_WEBHOOK_URL` is unset or Discord fails.

A delivery failure after the row is stored is logged with the report id and never fails the request. There is no retry worker; an unnotified row is found by its `discord_message_id IS NULL`.

## Screenshots for staff

`GET /api/feedback/:reportId/screenshot` reads `doc.feedback_screenshot` by `report_id` and returns the stored content type and WebP bytes with `Cache-Control: private, no-store`. The caller must be signed in and listed in `FEEDBACK_STAFF_MEMBER_IDS`. An empty list denies everyone. The webapp has no staff role; the allowlist is the only staff check, and it stays server side.

## Environment

All of these are optional. Without them the endpoint stores reports (once the table exists) and logs the delivery failures.

| Variable | Purpose |
| --- | --- |
| `DISCORD_FEEDBACK_FORUM_CHANNEL_ID` | The private staff forum's channel id. With `DISCORD_BOT_TOKEN`, the bot posts reports and adds the Details button. |
| `DISCORD_FEEDBACK_WEBHOOK_URL` | The private staff forum's webhook. The fallback when the bot is not set up or fails. |
| `DISCORD_FEEDBACK_STAFF_USER_IDS` | Comma separated Discord user ids allowed to press Details. |
| `DISCORD_FEEDBACK_STAFF_ROLE_IDS` | Comma separated Discord role ids allowed to press Details. Both lists empty denies everyone. |
| `DISCORD_FEEDBACK_TAG_IDS` | JSON map of kind to forum tag id, such as `{"bug":"123","idea":"456","data":"789","contact":"012"}`. |
| `FEEDBACK_STAFF_MEMBER_IDS` | Comma separated member ids allowed to read screenshots. |
| `AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD` | Existing SMTP credentials for the email path. |
| `APP_ORIGIN`, `SOURCE_COMMIT` | Existing. The origin check, the Open page and Screenshot links, and the build commit in the metadata. |
| `DISCORD_BOT_TOKEN` | Existing. The bot's token, also used for the bot path. |

## Tests

```sh
cd goodwatch-webapp
node --test app/server/feedback/*.test.ts
```

`discord.test.ts` covers both delivery paths (bot thread with the Details button and media gallery, webhook with only link buttons and the spoilered details line, the bot-to-webhook fallback, duplicate replies), the data report layout and reference links, Discord's limits, text sanitizing, the Details staff check (user list, role list, deny by default, before storage), and the router hand-off.

The tests use fakes for storage, the limiter, the session, Discord, and email. They cover validation, origin, body cap, both rate limits, the hashed limiter key, query secret removal, the Discord payload and its sanitizing, the email fallback, idempotency, the soft storage failure, screenshot normalization, and the staff check. The store tests inject SQL results to cover dedupe misses, both open statuses, closed statuses, version conflicts, merged retries, status validation, screenshot table writes and reads, and screenshot storage failure. No test contacts a database or delivery service.

## Release checklist

1. Create the Discord forum channel and its four tags, then a webhook for it.
2. Set `DISCORD_FEEDBACK_WEBHOOK_URL`, `DISCORD_FEEDBACK_TAG_IDS`, and `FEEDBACK_STAFF_MEMBER_IDS` in Coolify.
3. Run `f/sync/init/cratedb` (dry run, then apply) to create `doc.feedback_report` and `doc.feedback_screenshot`.
4. Send one report of each kind from the site and check that each post carries the right tag.

### Enable the Details button

1. In the forum channel's permissions, give the GoodWatch bot (or its role) View Channel, Send Messages, Create Posts, Send Messages in Threads, Attach Files, and Read Message History. A private forum needs the bot added explicitly.
2. Set `DISCORD_FEEDBACK_FORUM_CHANNEL_ID` (right-click the forum, Copy Channel ID, with Developer Mode on) and `DISCORD_FEEDBACK_STAFF_USER_IDS` and/or `DISCORD_FEEDBACK_STAFF_ROLE_IDS` in Coolify. Keep `DISCORD_FEEDBACK_WEBHOOK_URL` as the fallback.
3. Send one report and press Details as staff and as a non-staff account.
